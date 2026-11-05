import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureTokenFromUrl,
  clearToken,
  getToken,
  parseTokenInput,
  setToken,
} from "./token";

function openAt(url: string) {
  window.history.replaceState(null, "", url);
}

function currentUrl() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function breakStorage() {
  const fail = () => {
    throw new DOMException("Storage is disabled", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(fail);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(fail);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(fail);
}

beforeEach(() => {
  clearToken();
  localStorage.clear();
  openAt("/");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("token storage", () => {
  it("has no token at first", () => {
    expect(getToken()).toBeNull();
  });

  it("returns the token that was set", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
  });

  it("keeps the token in localStorage, so it survives a reload", () => {
    setToken("abc");
    expect(Object.values({ ...localStorage })).toContain("abc");
  });

  it("forgets the token when cleared", () => {
    setToken("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("does not throw when storage is unavailable", () => {
    breakStorage();
    expect(() => setToken("abc")).not.toThrow();
    expect(() => getToken()).not.toThrow();
    expect(() => clearToken()).not.toThrow();
  });

  it("keeps the token for this page load when storage is unavailable", () => {
    breakStorage();
    setToken("abc");
    expect(getToken()).toBe("abc");
    clearToken();
    expect(getToken()).toBeNull();
  });
});

describe("captureTokenFromUrl (03-C1)", () => {
  it("stores the token from the private link and removes it from the address bar", () => {
    openAt("/?token=abc");

    expect(captureTokenFromUrl()).toBe("abc");

    expect(getToken()).toBe("abc");
    expect(currentUrl()).toBe("/");
  });

  it("replaces an older stored token", () => {
    setToken("old");
    openAt("/?token=new");

    captureTokenFromUrl();

    expect(getToken()).toBe("new");
  });

  it("keeps the stored token when the app opens without the parameter", () => {
    setToken("abc");
    openAt("/");

    expect(captureTokenFromUrl()).toBeNull();

    expect(getToken()).toBe("abc");
    expect(currentUrl()).toBe("/");
  });

  it("keeps other query parameters and the hash", () => {
    openAt("/recipes?token=abc&view=list#top");

    captureTokenFromUrl();

    expect(currentUrl()).toBe("/recipes?view=list#top");
  });

  it("does not add a history entry", () => {
    openAt("/?token=abc");
    const length = window.history.length;

    captureTokenFromUrl();

    expect(window.history.length).toBe(length);
  });

  it.each(["/?token=", "/?token=%20%20"])(
    "ignores an empty token but still removes it from the URL: %s",
    (url) => {
      setToken("abc");
      openAt(url);

      expect(captureTokenFromUrl()).toBeNull();

      expect(getToken()).toBe("abc");
      expect(currentUrl()).toBe("/");
    },
  );

  it("removes the token from the URL even when storage is unavailable", () => {
    breakStorage();
    openAt("/?token=abc");

    captureTokenFromUrl();

    expect(currentUrl()).toBe("/");
    expect(getToken()).toBe("abc");
  });
});

describe("parseTokenInput", () => {
  it.each([
    ["a full private link", "https://escandaya.fly.dev/?token=abc", "abc"],
    ["a link with other parameters", "https://escandaya.fly.dev/?x=1&token=abc", "abc"],
    ["a link without the scheme", "escandaya.fly.dev/?token=abc", "abc"],
    ["a bare token", "abc", "abc"],
    ["a token with spaces around it", "  abc\n", "abc"],
    ["a link with spaces around it", "  https://escandaya.fly.dev/?token=abc  ", "abc"],
    ["a URL-safe token", "Ab_9-xY", "Ab_9-xY"],
  ])("reads %s", (_, input, expected) => {
    expect(parseTokenInput(input)).toBe(expected);
  });

  it.each([
    ["empty input", ""],
    ["only spaces", "   "],
    ["a link without a token", "https://escandaya.fly.dev/"],
    ["a link with an empty token", "https://escandaya.fly.dev/?token="],
    ["a link with other parameters only", "https://escandaya.fly.dev/?x=1"],
  ])("returns null for %s", (_, input) => {
    expect(parseTokenInput(input)).toBeNull();
  });
});
