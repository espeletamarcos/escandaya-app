import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type ApiErrorKind } from "../api/client";
import { useLoad } from "./useLoad";

const FAILED = "No se han podido cargar las preparaciones. Inténtalo de nuevo.";

function deferred<T>() {
  const calls: { resolve: (value: T) => void; reject: (error: unknown) => void }[] = [];
  const fn = vi.fn(
    () =>
      new Promise<T>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  return { fn, calls };
}

describe("useLoad (05-C4)", () => {
  it("loads on mount, then has the data", async () => {
    const load = deferred<string[]>();
    const { result } = renderHook(() => useLoad(load.fn, FAILED));

    expect(result.current.status).toBe("loading");
    expect(load.fn).toHaveBeenCalledOnce();

    await act(async () => load.calls[0].resolve(["Tartar"]));
    expect(result.current).toMatchObject({ status: "done", data: ["Tartar"] });
  });

  it.each<[ApiErrorKind | "other", string]>([
    ["network", "No hay conexión. Comprueba la red e inténtalo de nuevo."],
    ["unauthorized", "El acceso ya no es válido. Abre de nuevo el enlace privado."],
    ["timeout", "La carga ha tardado demasiado. Inténtalo de nuevo."],
    ["failed", FAILED],
    ["other", FAILED],
  ])("shows a readable message on %s", async (kind, message) => {
    const error = kind === "other" ? new Error("bug") : new ApiError(kind);
    const { result } = renderHook(() =>
      useLoad(async () => {
        throw error;
      }, FAILED),
    );

    await act(async () => {});
    expect(result.current).toMatchObject({ status: "error", error: message });
  });

  it("loads again on retry", async () => {
    const load = deferred<string[]>();
    const { result } = renderHook(() => useLoad(load.fn, FAILED));
    await act(async () => load.calls[0].reject(new ApiError("network")));

    act(() => result.current.retry());
    expect(result.current.status).toBe("loading");
    await act(async () => load.calls[1].resolve([]));

    expect(load.fn).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ status: "done", data: [] });
  });

  it("ignores a result that arrives after unmounting", async () => {
    const load = deferred<string[]>();
    const { result, unmount } = renderHook(() => useLoad(load.fn, FAILED));
    unmount();

    await act(async () => load.calls[0].resolve(["late"]));
    expect(result.current.status).toBe("loading");
  });
});
