import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, setToken } from "../auth/token";
import type { Draft, Sheet } from "../sheet/types";
import {
  ApiError,
  type ApiErrorKind,
  checkSession,
  createDraft,
  DRAFT_TIMEOUT_MS,
  onUnauthorized,
  SESSION_TIMEOUT_MS,
  transcribe,
  TRANSCRIBE_TIMEOUT_MS,
} from "./client";

const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body?: unknown) {
  fetchMock.mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** A fetch that never answers, and rejects like the browser when its signal aborts. */
function hang() {
  fetchMock.mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      }),
  );
}

function lastRequest(): { url: string; init: RequestInit } {
  const [input, init] = fetchMock.mock.lastCall!;
  return { url: String(input), init: init ?? {} };
}

function headersOf(init: RequestInit) {
  return new Headers(init.headers);
}

async function errorKind(promise: Promise<unknown>): Promise<ApiErrorKind> {
  const error = await promise.then(
    () => {
      throw new Error("expected the call to fail");
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return (error as ApiError).kind;
}

const audio = () => new Blob(["voice"], { type: "audio/webm;codecs=opus" });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  clearToken();
  setToken("chef-token");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  clearToken();
});

describe("checkSession (03-C2)", () => {
  it("calls GET /api/session with the token", async () => {
    respond(204);

    await checkSession();

    const { url, init } = lastRequest();
    expect(url).toBe("/api/session");
    expect(init.method ?? "GET").toBe("GET");
    expect(headersOf(init).get("Authorization")).toBe("Bearer chef-token");
  });

  it("is valid on 204", async () => {
    respond(204);
    await expect(checkSession()).resolves.toBe(true);
    expect(getToken()).toBe("chef-token");
  });

  it("is invalid on 401 and clears the token", async () => {
    respond(401, { detail: "Invalid token" });

    await expect(checkSession()).resolves.toBe(false);

    expect(getToken()).toBeNull();
  });

  it("is invalid without a stored token, without calling the backend", async () => {
    clearToken();

    await expect(checkSession()).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails with network when the backend cannot be reached, keeping the token", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await errorKind(checkSession())).toBe("network");
    expect(getToken()).toBe("chef-token");
  });

  it("fails with failed on a server error, keeping the token", async () => {
    respond(500);

    expect(await errorKind(checkSession())).toBe("failed");
    expect(getToken()).toBe("chef-token");
  });

  it("times out after the session limit", async () => {
    vi.useFakeTimers();
    hang();

    const result = errorKind(checkSession());
    await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS);

    expect(await result).toBe("timeout");
  });
});

describe("transcribe (03-C4)", () => {
  it("posts the raw audio with its type and the token", async () => {
    respond(200, { text: "dos kilos de tartar" });
    const blob = audio();

    await transcribe(blob);

    const { url, init } = lastRequest();
    expect(url).toBe("/api/transcriptions");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(blob);
    const headers = headersOf(init);
    expect(headers.get("Content-Type")).toBe("audio/webm;codecs=opus");
    expect(headers.get("Authorization")).toBe("Bearer chef-token");
  });

  it("returns the text", async () => {
    respond(200, { text: "dos kilos de tartar" });
    await expect(transcribe(audio())).resolves.toBe("dos kilos de tartar");
  });

  it("returns empty text as it is", async () => {
    respond(200, { text: "" });
    await expect(transcribe(audio())).resolves.toBe("");
  });

  it.each<[number, ApiErrorKind]>([
    [401, "unauthorized"],
    [413, "too-large"],
    [415, "unsupported"],
    [502, "failed"],
    [503, "failed"],
    [500, "failed"],
    [404, "failed"],
    [504, "timeout"],
  ])("maps status %i to %s (03-C7)", async (status, kind) => {
    respond(status, { detail: "whatever" });
    expect(await errorKind(transcribe(audio()))).toBe(kind);
  });

  it.each([
    ["a body that is not JSON", () => new Response("<html>oops</html>", { status: 200 })],
    ["JSON without text", () => Response.json({ other: 1 })],
  ])("fails with failed on %s", async (_, makeResponse) => {
    fetchMock.mockResolvedValue(makeResponse());
    expect(await errorKind(transcribe(audio()))).toBe("failed");
  });

  it("fails with network when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await errorKind(transcribe(audio()))).toBe("network");
  });

  it("fails with unauthorized without a stored token, without calling the backend", async () => {
    clearToken();

    expect(await errorKind(transcribe(audio()))).toBe("unauthorized");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts after 90s and fails with timeout", async () => {
    vi.useFakeTimers();
    hang();

    const result = errorKind(transcribe(audio()));
    await vi.advanceTimersByTimeAsync(TRANSCRIBE_TIMEOUT_MS - 1);
    expect(lastRequest().init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(TRANSCRIBE_TIMEOUT_MS).toBe(90_000);
    expect(lastRequest().init.signal?.aborted).toBe(true);
    expect(await result).toBe("timeout");
  });

  it("does not abort a request that has already answered", async () => {
    vi.useFakeTimers();
    respond(200, { text: "hola" });

    await transcribe(audio());
    await vi.advanceTimersByTimeAsync(TRANSCRIBE_TIMEOUT_MS);

    expect(lastRequest().init.signal?.aborted).toBe(false);
  });
});

describe("on 401 (03-C2, revoked token)", () => {
  it("clears the token and tells the listeners", async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    respond(401);

    await errorKind(transcribe(audio()));

    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("also tells the listeners when checkSession gets a 401", async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    respond(401);

    await checkSession();

    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("stops telling a listener after it unsubscribes", async () => {
    const listener = vi.fn();
    onUnauthorized(listener)();
    respond(401);

    await errorKind(transcribe(audio()));

    expect(listener).not.toHaveBeenCalled();
  });

  it.each([413, 502, 504])("keeps the token on %i", async (status) => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    respond(status);

    await errorKind(transcribe(audio()));

    expect(getToken()).toBe("chef-token");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

const TUNA_SHEET: Sheet = {
  name: "Tartar de atún",
  yield: { quantity: 2, unit: "kg", estimated: true },
  covers: { value: 30, estimated: true },
  ingredients: [
    { name: "atún rojo", quantity: 1.5, unit: "kg", estimated: false },
    { name: "un puñado de cebollino", quantity: null, unit: null, estimated: false },
  ],
};

const TUNA_DRAFT: Draft = {
  is_preparation: true,
  sheet: TUNA_SHEET,
  missing: ["ingredients.1.quantity", "ingredients.1.unit"],
};

/** A copy of `value` without `key`. */
function without(value: object, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value };
  delete copy[key];
  return copy;
}

/** The tuna sheet with `changes` applied to its first ingredient. */
function withFirstIngredient(changes: Record<string, unknown>) {
  const [first, ...rest] = TUNA_SHEET.ingredients;
  return { ...TUNA_DRAFT, sheet: { ...TUNA_SHEET, ingredients: [{ ...first, ...changes }, ...rest] } };
}

describe("createDraft (04-C1, 04-C3, 04-C7)", () => {
  it("posts the text as JSON with the token", async () => {
    respond(200, TUNA_DRAFT);

    await createDraft("dos kilos de atún");

    const { url, init } = lastRequest();
    expect(url).toBe("/api/drafts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ text: "dos kilos de atún" });
    const headers = headersOf(init);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer chef-token");
  });

  it("returns the sheet and its missing data", async () => {
    respond(200, TUNA_DRAFT);
    await expect(createDraft("texto")).resolves.toEqual(TUNA_DRAFT);
  });

  it("returns a draft that is not a preparation", async () => {
    respond(200, { is_preparation: false, sheet: null, missing: [] });
    await expect(createDraft("hola")).resolves.toEqual({
      is_preparation: false,
      sheet: null,
      missing: [],
    });
  });

  it("accepts a sheet with no ingredients and nothing filled in", async () => {
    const empty = {
      is_preparation: true,
      sheet: {
        name: "Fondo",
        yield: { quantity: null, unit: null, estimated: false },
        covers: { value: null, estimated: false },
        ingredients: [],
      },
      missing: ["yield.quantity", "yield.unit", "covers"],
    };
    respond(200, empty);

    await expect(createDraft("texto")).resolves.toEqual(empty);
  });

  it.each<[number, ApiErrorKind]>([
    [401, "unauthorized"],
    [422, "failed"],
    [502, "failed"],
    [503, "failed"],
    [500, "failed"],
    [504, "timeout"],
  ])("maps status %i to %s", async (status, kind) => {
    respond(status, { detail: "whatever" });
    expect(await errorKind(createDraft("texto"))).toBe(kind);
  });

  it.each<[string, unknown]>([
    ["a list", [TUNA_DRAFT]],
    ["no is_preparation", { sheet: TUNA_SHEET, missing: [] }],
    ["is_preparation as a string", { ...TUNA_DRAFT, is_preparation: "true" }],
    ["no sheet", without(TUNA_DRAFT, "sheet")],
    ["a preparation with a null sheet", { ...TUNA_DRAFT, sheet: null }],
    ["not a preparation with a sheet", { ...TUNA_DRAFT, is_preparation: false }],
    ["no missing", { is_preparation: false, sheet: null }],
    ["missing with a number", { ...TUNA_DRAFT, missing: [1] }],
    ["a sheet without a name", { ...TUNA_DRAFT, sheet: { ...TUNA_SHEET, name: null } }],
    [
      "a yield with an unknown unit",
      { ...TUNA_DRAFT, sheet: { ...TUNA_SHEET, yield: { ...TUNA_SHEET.yield, unit: "taza" } } },
    ],
    [
      "covers as a string",
      { ...TUNA_DRAFT, sheet: { ...TUNA_SHEET, covers: { value: "30", estimated: false } } },
    ],
    [
      "ingredients that are not a list",
      { ...TUNA_DRAFT, sheet: { ...TUNA_SHEET, ingredients: {} } },
    ],
    [
      "an ingredient without estimated",
      { ...TUNA_DRAFT, sheet: { ...TUNA_SHEET, ingredients: [without(TUNA_SHEET.ingredients[0], "estimated")] } },
    ],
    ["an ingredient with an unknown unit", withFirstIngredient({ unit: "taza" })],
    ["an ingredient quantity as a string", withFirstIngredient({ quantity: "1,5" })],
    ["an ingredient name as a number", withFirstIngredient({ name: 7 })],
    ["an ingredient that is null", { ...TUNA_DRAFT, sheet: { ...TUNA_SHEET, ingredients: [null] } }],
  ])("fails with failed on %s", async (_, body) => {
    respond(200, body);
    expect(await errorKind(createDraft("texto"))).toBe("failed");
  });

  it("fails with failed on a body that is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    expect(await errorKind(createDraft("texto"))).toBe("failed");
  });

  it("fails with network when fetch rejects", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await errorKind(createDraft("texto"))).toBe("network");
  });

  it("fails with unauthorized without a stored token, without calling the backend", async () => {
    clearToken();

    expect(await errorKind(createDraft("texto"))).toBe("unauthorized");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts after 60s and fails with timeout", async () => {
    vi.useFakeTimers();
    hang();

    const result = errorKind(createDraft("texto"));
    await vi.advanceTimersByTimeAsync(DRAFT_TIMEOUT_MS - 1);
    expect(lastRequest().init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(DRAFT_TIMEOUT_MS).toBe(60_000);
    expect(lastRequest().init.signal?.aborted).toBe(true);
    expect(await result).toBe("timeout");
  });
});
