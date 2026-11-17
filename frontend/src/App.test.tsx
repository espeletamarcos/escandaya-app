import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App, { type AppApi, type SessionClient } from "./App";
import { ApiError } from "./api/client";
import { clearToken, getToken } from "./auth/token";
import type { PreparationSummary, SavedPreparation } from "./preparations/types";
import { FakeRecorder } from "./recorder/FakeRecorder";
import type { Draft, Sheet } from "./sheet/types";

type Outcome = boolean | Error | Promise<boolean>;

/** A fake API client: each checkSession() call takes the next outcome. */
function fakeSession(...outcomes: Outcome[]) {
  const listeners = new Set<() => void>();
  const checkSession = vi.fn(async () => {
    const outcome = outcomes.shift();
    if (outcome === undefined) throw new Error("unexpected checkSession call");
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  const session: SessionClient = {
    checkSession,
    onUnauthorized(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    session,
    checkSession,
    listenerCount: () => listeners.size,
    revoke: () => act(() => listeners.forEach((listener) => listener())),
  };
}

function deferred() {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
}

function renderApp(session: SessionClient) {
  return render(<App session={session} recorder={new FakeRecorder()} />);
}

const recordButton = () => screen.findByRole("button", { name: "Grabar" });
const blockScreen = () => screen.findByRole("heading", { name: "Acceso privado" });

function paste(text: string) {
  fireEvent.change(screen.getByLabelText("Enlace o código de acceso"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  clearToken();
});

afterEach(() => {
  cleanup();
  clearToken();
});

describe("App session gate (03-C2)", () => {
  it("shows a loading state while the session is checked", async () => {
    const pending = deferred();
    const fake = fakeSession(pending.promise);

    renderApp(fake.session);

    expect(screen.getByRole("status").textContent).toBe("Comprobando acceso…");
    expect(screen.queryByRole("button", { name: "Grabar" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Acceso privado" })).toBeNull();

    await act(async () => pending.resolve(true));
    await recordButton();
  });

  it("checks the session once when the app opens", async () => {
    const fake = fakeSession(true);

    renderApp(fake.session);

    await recordButton();
    expect(fake.checkSession).toHaveBeenCalledOnce();
  });

  it("shows the record screen with a valid token", async () => {
    renderApp(fakeSession(true).session);

    await recordButton();
    expect(screen.queryByRole("heading", { name: "Acceso privado" })).toBeNull();
  });

  it("shows the block screen without a valid token", async () => {
    renderApp(fakeSession(false).session);

    await blockScreen();
    expect(screen.getByText(/enlace privado/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Grabar" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("unlocks after pasting a valid link", async () => {
    const fake = fakeSession(false, true);
    renderApp(fake.session);
    await blockScreen();

    paste("https://escandaya.fly.dev/?token=abc");

    await recordButton();
    expect(getToken()).toBe("abc");
    expect(fake.checkSession).toHaveBeenCalledTimes(2);
  });

  it("unlocks after pasting a bare token", async () => {
    renderApp(fakeSession(false, true).session);
    await blockScreen();

    paste("abc");

    await recordButton();
    expect(getToken()).toBe("abc");
  });

  it("stays blocked with a message when the pasted token is rejected", async () => {
    renderApp(fakeSession(false, false).session);
    await blockScreen();

    paste("wrong-token");

    expect((await screen.findByRole("alert")).textContent).toBe("Ese enlace no es válido");
    expect(screen.getByRole("heading", { name: "Acceso privado" })).toBeDefined();
  });

  it("does not call the backend when the pasted text has no token", async () => {
    const fake = fakeSession(false);
    renderApp(fake.session);
    await blockScreen();

    paste("https://escandaya.fly.dev/");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No es un enlace ni un código válido",
    );
    expect(fake.checkSession).toHaveBeenCalledOnce();
  });

  it("goes back to the block screen when a call gets a 401 (revoked token)", async () => {
    const fake = fakeSession(true);
    renderApp(fake.session);
    await recordButton();

    fake.revoke();

    await blockScreen();
    expect(screen.queryByRole("button", { name: "Grabar" })).toBeNull();
  });

  it("stops listening for 401s when it unmounts", async () => {
    const fake = fakeSession(true);
    const { unmount } = renderApp(fake.session);
    await recordButton();
    expect(fake.listenerCount()).toBe(1);

    unmount();

    expect(fake.listenerCount()).toBe(0);
  });

  it("ignores a stale first check under StrictMode", async () => {
    // StrictMode mounts twice in development; only the last check may decide.
    const first = deferred();
    const fake = fakeSession(first.promise, true);

    render(
      <StrictMode>
        <App session={fake.session} recorder={new FakeRecorder()} />
      </StrictMode>,
    );
    await recordButton();
    await act(async () => first.resolve(false));

    expect(screen.getByRole("button", { name: "Grabar" })).toBeDefined();
  });
});

describe("App when the session cannot be checked", () => {
  it.each(["network", "failed", "timeout"] as const)(
    "shows a retry screen on %s, not the block screen",
    async (kind) => {
      renderApp(fakeSession(new ApiError(kind)).session);

      expect((await screen.findByRole("alert")).textContent).toBe(
        "No se ha podido comprobar el acceso",
      );
      expect(screen.getByText(/conexión/)).toBeDefined();
      expect(screen.queryByRole("heading", { name: "Acceso privado" })).toBeNull();
    },
  );

  it("checks again on retry and unlocks", async () => {
    const fake = fakeSession(new ApiError("network"), true);
    renderApp(fake.session);

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    await recordButton();
    expect(fake.checkSession).toHaveBeenCalledTimes(2);
  });

  it("shows the block screen if the retry finds the token invalid", async () => {
    renderApp(fakeSession(new ApiError("network"), false).session);

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    await blockScreen();
  });

  it("shows the retry screen when the check after a paste cannot finish", async () => {
    renderApp(fakeSession(false, new ApiError("network")).session);
    await blockScreen();

    paste("abc");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No se ha podido comprobar el acceso",
    );
  });
});

describe("App navigation (05-C1, 05-C4)", () => {
  const SHEET: Sheet = {
    name: "Tartar de atún",
    yield: { quantity: 2, unit: "kg", estimated: false },
    covers: { value: 40, estimated: false },
    ingredients: [{ name: "atún rojo", quantity: 1.8, unit: "kg", estimated: false }],
  };
  const DRAFT: Draft = { is_preparation: true, sheet: SHEET, missing: [] };
  const SAVED: SavedPreparation = {
    id: 7,
    confirmed_at: "2026-11-14T12:30:00Z",
    sheet: SHEET,
    missing: [],
  };
  const SUMMARY: PreparationSummary = {
    id: 7,
    name: "Tartar de atún",
    covers: 40,
    missing_count: 0,
    confirmed_at: "2026-11-14T12:30:00Z",
  };

  function fakeApi(changes: Partial<AppApi> = {}): AppApi {
    return {
      transcribe: vi.fn(async () => "dos kilos de tartar"),
      createDraft: vi.fn(async () => DRAFT),
      confirmPreparation: vi.fn(async () => SAVED),
      listPreparations: vi.fn(async () => [SUMMARY]),
      getPreparation: vi.fn(async () => SAVED),
      ...changes,
    };
  }

  async function renderUnlocked(api: AppApi = fakeApi()) {
    render(<App session={fakeSession(true).session} recorder={new FakeRecorder()} api={api} />);
    await recordButton();
    return api;
  }

  const nav = (name: string) =>
    within(screen.getByRole("navigation", { name: "Secciones" })).getByRole("button", { name });
  /** The sheet's name field, opening its line first: the sheet is edited line by line (09-C8). */
  const sheetName = () => {
    if (!screen.queryByLabelText("Nombre")) {
      fireEvent.click(screen.getByRole("button", { name: /^Editar nombre/ }));
    }
    return screen.getByLabelText("Nombre") as HTMLInputElement;
  };

  async function makeSheet() {
    fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Parar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Transcribir y crear ficha" }));
    await screen.findByRole("form", { name: "Ficha" });
  }

  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();
  });

  it("opens on the record screen, with both sections in the navigation", async () => {
    await renderUnlocked();

    expect(nav("Nueva ficha").getAttribute("aria-current")).toBe("page");
    expect(nav("Preparaciones").hasAttribute("aria-current")).toBe(false);
  });

  it("shows the list from Preparaciones, and hides the record screen", async () => {
    const api = await renderUnlocked();

    fireEvent.click(nav("Preparaciones"));

    expect(await screen.findByRole("heading", { name: "Preparaciones" })).toBeDefined();
    expect(api.listPreparations).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Grabar" })).toBeNull();
    expect(nav("Preparaciones").getAttribute("aria-current")).toBe("page");
  });

  it("opens a preparation from the list, and goes back with Volver", async () => {
    const api = await renderUnlocked();
    fireEvent.click(nav("Preparaciones"));

    fireEvent.click(await screen.findByRole("button", { name: /Tartar de atún/ }));
    expect(await screen.findByRole("article", { name: "Ficha guardada" })).toBeDefined();
    expect(api.getPreparation).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(await screen.findByRole("heading", { name: "Preparaciones" })).toBeDefined();
    expect(screen.queryByRole("article", { name: "Ficha guardada" })).toBeNull();
  });

  it("keeps an unconfirmed sheet and its edits while the list is open", async () => {
    await renderUnlocked();
    await makeSheet();
    fireEvent.change(sheetName(), { target: { value: "Tartar editado" } });

    fireEvent.click(nav("Preparaciones"));
    await screen.findByRole("heading", { name: "Preparaciones" });
    fireEvent.click(nav("Nueva ficha"));

    expect(sheetName().value).toBe("Tartar editado");
  });

  it("after a save, shows Ficha guardada on the list and starts a new record screen", async () => {
    const api = await renderUnlocked();
    await makeSheet();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar ficha" }));

    expect((await screen.findByRole("status")).textContent).toBe("Ficha guardada");
    expect(screen.getByRole("heading", { name: "Preparaciones" })).toBeDefined();
    expect(api.confirmPreparation).toHaveBeenCalledOnce();

    fireEvent.click(nav("Nueva ficha"));
    expect(screen.getByRole("button", { name: "Grabar" })).toBeDefined();
    expect(screen.queryByRole("form", { name: "Ficha" })).toBeNull();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("drops the Ficha guardada notice once the chef moves on", async () => {
    await renderUnlocked();
    await makeSheet();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ficha" }));
    await screen.findByRole("status");

    fireEvent.click(nav("Nueva ficha"));
    fireEvent.click(nav("Preparaciones"));
    await screen.findByRole("heading", { name: "Preparaciones" });
    await act(async () => {});

    expect(screen.queryByText("Ficha guardada")).toBeNull();
  });

  it("loads the list again each time it is opened", async () => {
    const api = await renderUnlocked();

    fireEvent.click(nav("Preparaciones"));
    await screen.findByRole("heading", { name: "Preparaciones" });
    fireEvent.click(nav("Nueva ficha"));
    fireEvent.click(nav("Preparaciones"));
    await screen.findByRole("heading", { name: "Preparaciones" });

    expect(api.listPreparations).toHaveBeenCalledTimes(2);
  });
});
