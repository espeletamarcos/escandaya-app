import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { formatDate, formatDay } from "../preparations/format";
import SheetView from "./SheetView";
import type { Sheet } from "./types";

const SHEET: Sheet = {
  name: "Tartar de atún",
  yield: { quantity: 2.5, unit: "kg", estimated: true },
  covers: { value: 30, estimated: false },
  ingredients: [
    { name: "atún rojo", quantity: 1500, unit: "g", estimated: false },
    { name: "un puñado de cebollino", quantity: null, unit: null, estimated: false },
    { name: "aceite", quantity: 0.25, unit: "l", estimated: true },
  ],
};
const MISSING = ["ingredients.1.quantity", "ingredients.1.unit"];

/** The text of the value next to a label ("Rendimiento", "Raciones"). */
const valueOf = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent;

const ingredientRows = () =>
  within(screen.getByRole("list", { name: "Ingredientes" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent);

afterEach(cleanup);

describe("SheetView (05-C4)", () => {
  it("shows the name as the screen's title, on its tape", () => {
    render(<SheetView sheet={SHEET} missing={MISSING} />);
    const title = screen.getByRole("heading", { level: 1, name: "Tartar de atún" });
    expect(title.querySelector(".screen-title-tape")).not.toBeNull();
  });

  it("reads ≈ as estimado, for screen readers (09-C7)", () => {
    render(<SheetView sheet={SHEET} missing={MISSING} />);
    const yieldValue = screen.getByText("Rendimiento", { selector: "dt" }).nextElementSibling;

    expect(yieldValue?.querySelector("[aria-hidden='true']")?.textContent).toBe("≈ ");
    expect(yieldValue?.querySelector(".visually-hidden")?.textContent).toBe("(estimado)");
  });

  it("shows the confirmation day in red and its date and time", () => {
    render(<SheetView sheet={SHEET} missing={MISSING} confirmedAt="2026-11-14T10:42:00Z" />);

    const day = document.querySelector("time.sheet-date");
    expect(day?.getAttribute("datetime")).toBe("2026-11-14T10:42:00Z");
    expect(day?.textContent).toBe(formatDay("2026-11-14T10:42:00Z"));
    expect(document.body.textContent).toContain(`Confirmada el ${formatDate("2026-11-14T10:42:00Z")}`);
  });

  it("shows the yield and covers in Spanish style, with estimated values marked", () => {
    render(<SheetView sheet={SHEET} missing={MISSING} />);

    expect(valueOf("Rendimiento")).toBe("≈ 2,5 kg (estimado)");
    expect(valueOf("Raciones")).toBe("30 raciones");
  });

  it("shows each ingredient in order, with what is missing marked", () => {
    render(<SheetView sheet={SHEET} missing={MISSING} />);

    expect(ingredientRows()).toEqual([
      "atún rojo 1500 g",
      "un puñado de cebollino Falta",
      "aceite ≈ 0,25 l (estimado)",
    ]);
  });

  it("marks a missing yield and covers", () => {
    const sheet: Sheet = {
      ...SHEET,
      yield: { quantity: null, unit: null, estimated: false },
      covers: { value: null, estimated: false },
    };
    render(<SheetView sheet={sheet} missing={["yield.quantity", "yield.unit", "covers"]} />);

    expect(valueOf("Rendimiento")).toBe("Rendimiento Falta");
    expect(valueOf("Raciones")).toBe("Raciones Falta");
  });

  it("says which part of an amount is missing when only one is", () => {
    const sheet: Sheet = {
      ...SHEET,
      yield: { quantity: null, unit: "kg", estimated: false },
      ingredients: [{ name: "sal", quantity: 10, unit: null, estimated: false }],
    };
    render(
      <SheetView sheet={sheet} missing={["yield.quantity", "ingredients.0.unit"]} />,
    );

    expect(valueOf("Rendimiento")).toBe("kg · falta la cantidad");
    expect(ingredientRows()).toEqual(["sal 10 · falta la unidad"]);
  });

  it("marks estimated covers", () => {
    render(<SheetView sheet={{ ...SHEET, covers: { value: 40, estimated: true } }} missing={[]} />);
    expect(valueOf("Raciones")).toBe("≈ 40 raciones (estimado)");
  });

  it("uses the backend's missing list for the marks", () => {
    // The backend is the authority: a path it lists is marked.
    render(<SheetView sheet={SHEET} missing={["covers"]} />);
    expect(valueOf("Raciones")).toBe("Raciones Falta");
  });

  it("gives every mark the same class, so they can be styled together", () => {
    render(<SheetView sheet={SHEET} missing={MISSING} />);
    const marks = Array.from(document.querySelectorAll(".sheet-missing")).map((m) => m.textContent);
    expect(marks).toEqual(["Falta"]);
  });

  it("says when there are no ingredients", () => {
    render(<SheetView sheet={{ ...SHEET, ingredients: [] }} missing={[]} />);

    expect(screen.queryByRole("list", { name: "Ingredientes" })).toBeNull();
    expect(screen.getByText("Sin ingredientes")).toBeDefined();
  });

  it("has no inputs: it is read-only", () => {
    render(<SheetView sheet={SHEET} missing={MISSING} />);

    expect(screen.queryAllByRole("textbox")).toEqual([]);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
