import { clearToken, getToken } from "../auth/token";

const API_BASE = "/api";

// The backend gives up on OpenAI at 60s, so its 504 normally arrives first.
// This covers a backend or connection that hangs.
export const TRANSCRIBE_TIMEOUT_MS = 90_000;
export const SESSION_TIMEOUT_MS = 10_000;

/** What went wrong, so the UI can show a readable message for each case. */
export type ApiErrorKind =
  | "unauthorized"
  | "too-large"
  | "unsupported"
  | "failed"
  | "timeout"
  | "network";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind) {
    super(`API request failed: ${kind}`);
    this.name = "ApiError";
    this.kind = kind;
  }
}

// --- 401 handling -----------------------------------------------------------
// The client clears the token; listeners (the App gate) switch to the block screen.

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Call `listener` on any 401. Returns a function that unsubscribes it. */
export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function handleUnauthorized(): void {
  clearToken();
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

// --- Requests ---------------------------------------------------------------

function errorForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 401:
      return "unauthorized";
    case 413:
      return "too-large";
    case 415:
      return "unsupported";
    case 504:
      return "timeout";
    default:
      return "failed";
  }
}

/**
 * Send a request with the token and read its response, all within `timeoutMs`.
 * Every failure becomes an ApiError; a 401 also clears the token.
 */
async function protectedRequest<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  const token = getToken();
  if (token === null) {
    handleUnauthorized();
    throw new ApiError("unauthorized");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(controller.signal.aborted ? "timeout" : "network");
    }

    if (response.status === 401) {
      handleUnauthorized();
    }
    if (!response.ok) {
      throw new ApiError(errorForStatus(response.status));
    }

    try {
      return await read(response);
    } catch {
      throw new ApiError(controller.signal.aborted ? "timeout" : "failed");
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check the stored token: true if the backend accepts it, false if it is missing or
 * rejected (the token is then cleared). Other failures throw an ApiError, so having
 * no signal is not mistaken for a wrong token.
 */
export async function checkSession(): Promise<boolean> {
  if (getToken() === null) {
    return false;
  }
  try {
    await protectedRequest("/session", { method: "GET" }, SESSION_TIMEOUT_MS, async () => {});
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.kind === "unauthorized") {
      return false;
    }
    throw error;
  }
}

/** Send the recording as the raw body, with its own type, and return the Spanish text. */
export async function transcribe(audio: Blob): Promise<string> {
  return protectedRequest(
    "/transcriptions",
    { method: "POST", body: audio, headers: { "Content-Type": audio.type } },
    TRANSCRIBE_TIMEOUT_MS,
    async (response) => {
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("text" in body) ||
        typeof body.text !== "string"
      ) {
        throw new Error("Unexpected transcription response");
      }
      return body.text;
    },
  );
}

export async function getHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}