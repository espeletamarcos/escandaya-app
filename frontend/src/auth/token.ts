// The access token from the private link (`/?token=...`), kept in localStorage.
// Every storage access is guarded: private mode or blocked site data can make it throw.

const STORAGE_KEY = "escandaya.token";
const URL_PARAM = "token";

// Used when storage is unavailable, so the token still works until the page is closed.
let memoryToken: string | null = null;

export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Kept in memory only.
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored to remove.
  }
}

/**
 * Store the token from `?token=` (replacing any older one) and remove it from the
 * address bar without adding a history entry. Call once, before the app renders.
 * Returns the captured token, or null if the URL had none.
 */
export function captureTokenFromUrl(): string | null {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(URL_PARAM)) {
    return null;
  }

  const token = url.searchParams.get(URL_PARAM)?.trim() || null;
  if (token !== null) {
    setToken(token);
  }

  url.searchParams.delete(URL_PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return token;
}

/** Read a token from what the chef pastes: the full private link or the bare token. */
export function parseTokenInput(input: string): string | null {
  const text = input.trim();
  if (text === "") {
    return null;
  }

  const looksLikeLink = /[/?:]/.test(text);
  if (!looksLikeLink) {
    return text;
  }

  try {
    // The base lets a link without a scheme (`escandaya.fly.dev/?token=X`) parse too.
    const url = new URL(text, "https://placeholder.invalid");
    return url.searchParams.get(URL_PARAM)?.trim() || null;
  } catch {
    return null;
  }
}
