import { clearToken, getToken } from "../auth/token";
import { type Draft, type Ingredient, type Sheet, type Unit, UNITS } from "../sheet/types";

const API_BASE = "/api";

// The backend gives up on OpenAI at 60s, so its 504 normally arrives first.
// This covers a backend or connection that hangs.
export const TRANSCRIBE_TIMEOUT_MS = 90_000;
export const SESSION_TIMEOUT_MS = 10_000;
// The backend gives up on OpenAI at 45s; the machine is already warm after transcribing.
export const DRAFT_TIMEOUT_MS = 60_000;

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

// --- Draft response check -----------------------------------------------------
// The screens rely on this shape, so anything else is a failed request, not a crash.
// Limits (quantities > 0, name lengths…) are the backend's job and are not rechecked.

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isUnitOrNull(value: unknown): value is Unit | null {
  return value === null || (UNITS as readonly unknown[]).includes(value);
}

function isAmount(value: unknown): boolean {
  return (
    isObject(value) &&
    isNumberOrNull(value.quantity) &&
    isUnitOrNull(value.unit) &&
    typeof value.estimated === "boolean"
  );
}

function isIngredient(value: unknown): value is Ingredient {
  return isObject(value) && typeof value.name === "string" && isAmount(value);
}

function isSheet(value: unknown): value is Sheet {
  return (
    isObject(value) &&
    typeof value.name === "string" &&
    isAmount(value.yield) &&
    isObject(value.covers) &&
    isNumberOrNull(value.covers.value) &&
    typeof value.covers.estimated === "boolean" &&
    Array.isArray(value.ingredients) &&
    value.ingredients.every(isIngredient)
  );
}

function isDraft(value: unknown): value is Draft {
  if (
    !isObject(value) ||
    !Array.isArray(value.missing) ||
    !value.missing.every((path) => typeof path === "string")
  ) {
    return false;
  }
  if (value.is_preparation === true) {
    return isSheet(value.sheet);
  }
  return value.is_preparation === false && value.sheet === null;
}

/** Send the transcript and return the sheet the backend made of it, with its missing data. */
export async function createDraft(text: string): Promise<Draft> {
  return protectedRequest(
    "/drafts",
    {
      method: "POST",
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
    },
    DRAFT_TIMEOUT_MS,
    async (response) => {
      const body: unknown = await response.json();
      if (!isDraft(body)) {
        throw new Error("Unexpected draft response");
      }
      return body;
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