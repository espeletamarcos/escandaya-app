import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { formatDate } from "../preparations/format";
import type { SavedPreparation } from "../preparations/types";
import PreparationScreen from "./PreparationScreen";

const SAVED: SavedPreparation = {
  id: 7,
  confirmed_at: "2026-11-14T12:30:00Z",
  sheet: {
    name: "Tartar de atún",
    yield: { quantity: 2, unit: "kg", estimated: false },
    covers: { value: null, estimated: false },
    ingredients: [{ name: "atún rojo", quantity: 1.8, unit: "kg", estimated: false }],
  },
  missing: ["covers"],
};

const getOk = () => vi.fn<(id: number) => Promise<SavedPreparation>>(async () => SAVED);

function renderScreen(getPreparation = getOk(), onBack = vi.fn()) {
  render(<PreparationScreen id={7} getPreparation={getPreparation} onBack={onBack} />);
  return { getPreparation, onBack };
}

afterEach(cleanup);

describe("PreparationScreen (05-C4)", () => {
  it("loads the preparation by its id", async () => {
    const { getPreparation } = renderScreen();
    await screen.findByRole("heading", { name: "Tartar de atún" });

    expect(getPreparation).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("shows Cargando… while it loads", () => {
    renderScreen(vi.fn(() => new Promise<SavedPreparation>(() => {})));
    expect(screen.getByText("Cargando…")).toBeDefined();
  });

  it("shows the sheet read-only, with its missing data and date", async () => {
    renderScreen();
    await screen.findByRole("heading", { name: "Tartar de atún" });

    expect(screen.getByRole("article", { name: "Ficha guardada" })).toBeDefined();
    expect(document.querySelector(".sheet-missing")?.textContent).toBe("Falta");
    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(document.body.textContent).toContain(`Confirmada el ${formatDate(SAVED.confirmed_at)}`);
  });

  it("goes back with Volver", async () => {
    const { onBack } = renderScreen();
    await screen.findByRole("heading", { name: "Tartar de atún" });

    fireEvent.click(screen.getByRole("button", { name: "Volver a Preparaciones" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("can go back while it is still loading", () => {
    const { onBack } = renderScreen(vi.fn(() => new Promise<SavedPreparation>(() => {})));

    fireEvent.click(screen.getByRole("button", { name: "Volver a Preparaciones" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows a readable error with a retry", async () => {
    const getPreparation = vi
      .fn<(id: number) => Promise<SavedPreparation>>()
      .mockRejectedValueOnce(new ApiError("failed"))
      .mockResolvedValueOnce(SAVED);
    renderScreen(getPreparation);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No se ha podido cargar la preparación. Inténtalo de nuevo.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "Tartar de atún" })).toBeDefined();
    expect(getPreparation).toHaveBeenCalledTimes(2);
  });
});
