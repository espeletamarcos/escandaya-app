import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type ApiErrorKind } from "../api/client";
import type { Sheet } from "../sheet/types";
import type { ConfirmInput, SavedPreparation } from "./types";
import { type ConfirmFn, useConfirm } from "./useConfirm";

const TRANSCRIPT = "dos kilos de atún para treinta raciones";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SHEET: Sheet = {
  name: "Tartar de atún",
  yield: { quantity: 2, unit: "kg", estimated: false },
  covers: { value: 30, estimated: false },
  ingredients: [{ name: "atún rojo", quantity: null, unit: null, estimated: false }],
};
const SAVED: SavedPreparation = {
  id: 7,
  confirmed_at: "2026-11-14T12:30:00Z",
  sheet: SHEET,
  missing: ["ingredients.0.quantity", "ingredients.0.unit"],
};

/** A confirm whose results the test settles by hand, one per call. */
function deferred() {
  const calls: { resolve: (value: SavedPreparation) => void; reject: (error: unknown) => void }[] =
    [];
  const fn = vi.fn<ConfirmFn>(
    () =>
      new Promise<SavedPreparation>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  return { fn, calls };
}

const confirmOk = () => vi.fn<ConfirmFn>(async () => SAVED);
const confirmFails = (error: unknown) =>
  vi.fn<ConfirmFn>(async () => {
    throw error;
  });

const sentInput = (fn: ReturnType<typeof vi.fn<ConfirmFn>>, call = 0): ConfirmInput =>
  fn.mock.calls[call][0];

describe("useConfirm (05-C1)", () => {
  it("starts idle with no error", () => {
    const { result } = renderHook(() => useConfirm(confirmOk(), TRANSCRIPT, vi.fn()));

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("sends the sheet, the transcript and a new UUID as the confirm id", async () => {
    const confirm = confirmOk();
    const { result } = renderHook(() => useConfirm(confirm, TRANSCRIPT, vi.fn()));

    await act(async () => result.current.confirm(SHEET));

    expect(confirm).toHaveBeenCalledTimes(1);
    const input = sentInput(confirm);
    expect(input.sheet).toEqual(SHEET);
    expect(input.transcript).toBe(TRANSCRIPT);
    expect(input.confirmId).toMatch(UUID);
  });

  it("is pending while waiting, then saved, and passes the saved copy on", async () => {
    const confirm = deferred();
    const onSaved = vi.fn();
    const { result } = renderHook(() => useConfirm(confirm.fn, TRANSCRIPT, onSaved));

    act(() => void result.current.confirm(SHEET));
    expect(result.current.status).toBe("pending");
    expect(onSaved).not.toHaveBeenCalled();

    await act(async () => confirm.calls[0].resolve(SAVED));
    expect(result.current.status).toBe("saved");
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(SAVED);
  });

  it("sends only one request when confirmed twice while pending", async () => {
    const confirm = deferred();
    const { result } = renderHook(() => useConfirm(confirm.fn, TRANSCRIPT, vi.fn()));

    act(() => void result.current.confirm(SHEET));
    act(() => void result.current.confirm(SHEET));

    expect(confirm.fn).toHaveBeenCalledTimes(1);
    await act(async () => confirm.calls[0].resolve(SAVED));
  });

  it("does not send again once saved", async () => {
    const confirm = confirmOk();
    const { result } = renderHook(() => useConfirm(confirm, TRANSCRIPT, vi.fn()));

    await act(async () => result.current.confirm(SHEET));
    await act(async () => result.current.confirm(SHEET));

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("retries with the same confirm id after an error", async () => {
    const confirm = deferred();
    const onSaved = vi.fn();
    const { result } = renderHook(() => useConfirm(confirm.fn, TRANSCRIPT, onSaved));

    act(() => void result.current.confirm(SHEET));
    await act(async () => confirm.calls[0].reject(new ApiError("timeout")));
    expect(result.current.status).toBe("error");
    expect(onSaved).not.toHaveBeenCalled();

    const edited = { ...SHEET, name: "Tartar" };
    act(() => void result.current.confirm(edited));
    expect(result.current.status).toBe("pending");
    expect(result.current.error).toBeNull();
    await act(async () => confirm.calls[1].resolve(SAVED));

    expect(sentInput(confirm.fn, 1).confirmId).toBe(sentInput(confirm.fn, 0).confirmId);
    expect(sentInput(confirm.fn, 1).sheet).toEqual(edited);
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("keeps the confirm id across renders", async () => {
    const confirm = confirmFails(new ApiError("network"));
    const { result, rerender } = renderHook(() => useConfirm(confirm, TRANSCRIPT, vi.fn()));

    await act(async () => result.current.confirm(SHEET));
    rerender();
    await act(async () => result.current.confirm(SHEET));

    expect(sentInput(confirm, 1).confirmId).toBe(sentInput(confirm, 0).confirmId);
  });

  it("gives a new sheet (a new mount) a new confirm id", async () => {
    const confirm = confirmOk();
    const first = renderHook(() => useConfirm(confirm, TRANSCRIPT, vi.fn()));
    await act(async () => first.result.current.confirm(SHEET));
    first.unmount();

    const second = renderHook(() => useConfirm(confirm, TRANSCRIPT, vi.fn()));
    await act(async () => second.result.current.confirm(SHEET));

    expect(sentInput(confirm, 1).confirmId).not.toBe(sentInput(confirm, 0).confirmId);
  });

  it.each<[ApiErrorKind | "other", string]>([
    ["network", "No hay conexión. La ficha no se ha guardado: comprueba la red e inténtalo de nuevo."],
    ["unauthorized", "El acceso ya no es válido. Abre de nuevo el enlace privado."],
    ["invalid", "La ficha tiene valores no válidos. Revísala e inténtalo de nuevo."],
    ["timeout", "Guardar la ficha ha tardado demasiado. Inténtalo de nuevo."],
    ["failed", "No se ha podido guardar la ficha. Inténtalo de nuevo."],
    ["other", "No se ha podido guardar la ficha. Inténtalo de nuevo."],
  ])("shows a readable message on %s", async (kind, message) => {
    const error = kind === "other" ? new Error("bug") : new ApiError(kind);
    const { result } = renderHook(() => useConfirm(confirmFails(error), TRANSCRIPT, vi.fn()));

    await act(async () => result.current.confirm(SHEET));

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(message);
  });

  it("ignores a result that arrives after the sheet is gone", async () => {
    const confirm = deferred();
    const onSaved = vi.fn();
    const { result, unmount } = renderHook(() => useConfirm(confirm.fn, TRANSCRIPT, onSaved));

    act(() => void result.current.confirm(SHEET));
    unmount();
    await act(async () => confirm.calls[0].resolve(SAVED));

    expect(onSaved).not.toHaveBeenCalled();
  });
});
