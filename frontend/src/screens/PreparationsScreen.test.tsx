import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { formatDate } from "../preparations/format";
import type { PreparationSummary } from "../preparations/types";
import PreparationsScreen from "./PreparationsScreen";

const TARTAR: PreparationSummary = {
  id: 7,
  name: "Tartar de atún",
  covers: 40,
  missing_count: 3,
  confirmed_at: "2026-11-14T12:30:00Z",
};
const FONDO: PreparationSummary = {
  id: 6,
  name: "Fondo oscuro",
  covers: null,
  missing_count: 0,
  confirmed_at: "2026-11-13T09:00:00Z",
};

const listOk = (items: PreparationSummary[] = [TARTAR, FONDO]) =>
  vi.fn(async () => items);

function renderScreen(
  listPreparations = listOk(),
  onOpen = vi.fn(),
  notice: string | null = null,
) {
  render(
    <PreparationsScreen listPreparations={listPreparations} onOpen={onOpen} notice={notice} />,
  );
  return { listPreparations, onOpen };
}

const items = () =>
  within(screen.getByRole("list", { name: "Preparaciones guardadas" })).getAllByRole("button");

afterEach(cleanup);

describe("PreparationsScreen (05-C4)", () => {
  it("shows Cargando… while the list loads", async () => {
    renderScreen(vi.fn(() => new Promise<PreparationSummary[]>(() => {})));
    expect(screen.getByText("Cargando…")).toBeDefined();
  });

  it("shows the saved preparations in the order the backend sends (newest first)", async () => {
    renderScreen();
    await screen.findByRole("list", { name: "Preparaciones guardadas" });

    expect(items().map((item) => item.querySelector(".preparation-name")?.textContent)).toEqual([
      "Tartar de atún",
      "Fondo oscuro",
    ]);
  });

  it("shows each one's covers, missing data and date", async () => {
    renderScreen();
    await screen.findByRole("list", { name: "Preparaciones guardadas" });
    const [tartar, fondo] = items();

    expect(tartar.textContent).toContain("40 raciones");
    expect(tartar.textContent).toContain("Faltan 3 datos");
    expect(tartar.textContent).toContain(formatDate(TARTAR.confirmed_at));
    expect(tartar.querySelector("time")?.getAttribute("datetime")).toBe(TARTAR.confirmed_at);
    expect(fondo.textContent).toContain("Raciones: falta");
    expect(fondo.textContent).toContain("Completa");
  });

  it("opens a preparation when it is tapped", async () => {
    const { onOpen } = renderScreen();
    await screen.findByRole("list", { name: "Preparaciones guardadas" });

    fireEvent.click(items()[1]);

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(6);
  });

  it("shows an empty state when there are none", async () => {
    renderScreen(listOk([]));

    expect(await screen.findByText("Aún no hay preparaciones")).toBeDefined();
    expect(screen.queryByRole("list", { name: "Preparaciones guardadas" })).toBeNull();
  });

  it("shows a readable error with a retry that loads again", async () => {
    const listPreparations = vi
      .fn<() => Promise<PreparationSummary[]>>()
      .mockRejectedValueOnce(new ApiError("failed"))
      .mockResolvedValueOnce([TARTAR]);
    renderScreen(listPreparations);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "No se han podido cargar las preparaciones. Inténtalo de nuevo.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("list", { name: "Preparaciones guardadas" });

    expect(listPreparations).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the notice it is given, such as Ficha guardada", async () => {
    renderScreen(listOk(), vi.fn(), "Ficha guardada");
    await act(async () => {});

    expect(screen.getByRole("status").textContent).toBe("Ficha guardada");
  });

  it("shows no notice by default", async () => {
    renderScreen();
    await act(async () => {});

    expect(screen.queryByRole("status")).toBeNull();
  });
});
