import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SheetForm from "./SheetForm";
import type { Sheet } from "./types";

const SHEET: Sheet = {
  name: "Tartar de atún",
  yield: { quantity: 2.5, unit: "kg", estimated: true },
  covers: { value: 30, estimated: false },
  ingredients: [
    { name: "atún rojo", quantity: 1500, unit: "g", estimated: false },
    { name: "un puñado de cebollino", quantity: null, unit: null, estimated: false },
  ],
};

const group = (name: string) => screen.getByRole("group", { name });
const ingredient = (position: number) => group(`Ingrediente ${position}`);
const control = (container: HTMLElement, label: string) =>
  within(container).getByLabelText(label) as HTMLInputElement & HTMLSelectElement;

/** The sheet's own name field; each ingredient row has a "Nombre" too. */
const sheetName = () =>
  screen.getAllByLabelText("Nombre").find((el) => el.closest("fieldset") === null) as HTMLInputElement;

/** The `name` of every control marked with "Falta", in page order. */
function markedFields(): (string | null)[] {
  return Array.from(document.querySelectorAll("[aria-invalid='true']")).map((el) =>
    el.getAttribute("name"),
  );
}

function isMarked(element: HTMLElement): boolean {
  const mark = document.getElementById(element.getAttribute("aria-describedby") ?? "");
  return element.getAttribute("aria-invalid") === "true" && mark?.textContent === "Falta";
}

const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SheetForm (04-C5)", () => {
  it("shows the sheet's values in labelled fields", () => {
    render(<SheetForm sheet={SHEET} />);

    expect(sheetName().value).toBe("Tartar de atún");
    expect(control(group("Rendimiento"), "Cantidad").value).toBe("2,5");
    expect(control(group("Rendimiento"), "Unidad").value).toBe("kg");
    expect(control(group("Raciones"), "Cantidad").value).toBe("30");

    const first = ingredient(1);
    expect(control(first, "Nombre").value).toBe("atún rojo");
    expect(control(first, "Cantidad").value).toBe("1500");
    expect(control(first, "Unidad").value).toBe("g");
    const second = ingredient(2);
    expect(control(second, "Nombre").value).toBe("un puñado de cebollino");
    expect(control(second, "Cantidad").value).toBe("");
    expect(control(second, "Unidad").value).toBe("");
  });

  it("shows estimated values through their checked toggle", () => {
    render(<SheetForm sheet={SHEET} />);

    expect(control(group("Rendimiento"), "Estimado").checked).toBe(true);
    expect(control(group("Raciones"), "Estimado").checked).toBe(false);
    expect(control(ingredient(1), "Estimado").checked).toBe(false);
  });

  it("uses the decimal keyboard for quantities and the numeric one for covers", () => {
    render(<SheetForm sheet={SHEET} />);

    expect(control(group("Rendimiento"), "Cantidad").getAttribute("inputmode")).toBe("decimal");
    expect(control(ingredient(1), "Cantidad").getAttribute("inputmode")).toBe("decimal");
    expect(control(group("Raciones"), "Cantidad").getAttribute("inputmode")).toBe("numeric");
  });

  it("offers an empty option and the five units", () => {
    render(<SheetForm sheet={SHEET} />);

    const options = Array.from(control(ingredient(1), "Unidad").options).map((o) => o.value);
    expect(options).toEqual(["", "g", "kg", "ml", "l", "ud"]);
  });

  it("marks exactly the missing fields of the returned sheet", () => {
    render(<SheetForm sheet={SHEET} />);

    expect(markedFields()).toEqual(["ingredients.1.quantity", "ingredients.1.unit"]);
    expect(isMarked(control(ingredient(2), "Cantidad"))).toBe(true);
    expect(isMarked(control(ingredient(2), "Unidad"))).toBe(true);
    expect(screen.getAllByText("Falta")).toHaveLength(2);
  });

  it("does not render a form that submits and reloads the page", () => {
    render(<SheetForm sheet={SHEET} />);

    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.submit(screen.getByRole("form", { name: "Ficha" }))).toBe(false);
  });
});

describe("editing (04-C6)", () => {
  it("changes the name, the yield and the covers", () => {
    render(<SheetForm sheet={SHEET} />);

    type(sheetName(), "Tartar");
    type(control(group("Rendimiento"), "Cantidad"), "0,");
    type(control(group("Rendimiento"), "Unidad"), "l");
    fireEvent.click(control(group("Rendimiento"), "Estimado"));
    type(control(group("Raciones"), "Cantidad"), "40");
    fireEvent.click(control(group("Raciones"), "Estimado"));

    expect(sheetName().value).toBe("Tartar");
    // The half-typed decimal comma stays.
    expect(control(group("Rendimiento"), "Cantidad").value).toBe("0,");
    expect(control(group("Rendimiento"), "Unidad").value).toBe("l");
    expect(control(group("Rendimiento"), "Estimado").checked).toBe(false);
    expect(control(group("Raciones"), "Cantidad").value).toBe("40");
    expect(control(group("Raciones"), "Estimado").checked).toBe(true);
  });

  it("changes each field of one ingredient", () => {
    render(<SheetForm sheet={SHEET} />);
    const second = ingredient(2);

    type(control(second, "Nombre"), "cebollino");
    type(control(second, "Cantidad"), "20,5");
    type(control(second, "Unidad"), "g");
    fireEvent.click(control(second, "Estimado"));

    expect(control(second, "Nombre").value).toBe("cebollino");
    expect(control(second, "Cantidad").value).toBe("20,5");
    expect(control(second, "Unidad").value).toBe("g");
    expect(control(second, "Estimado").checked).toBe(true);
    expect(control(ingredient(1), "Nombre").value).toBe("atún rojo");
  });

  it("removes a mark when the field is filled in, and adds it when it is emptied", () => {
    render(<SheetForm sheet={SHEET} />);

    type(control(ingredient(2), "Cantidad"), "20");
    type(control(ingredient(2), "Unidad"), "g");
    expect(markedFields()).toEqual([]);
    expect(screen.queryByText("Falta")).toBeNull();

    type(control(group("Raciones"), "Cantidad"), "");
    type(sheetName(), " ");
    expect(markedFields()).toEqual(["name", "covers"]);
    expect(isMarked(control(group("Raciones"), "Cantidad"))).toBe(true);
    expect(isMarked(sheetName())).toBe(true);
  });

  it("marks a quantity that is not a number", () => {
    render(<SheetForm sheet={SHEET} />);

    type(control(ingredient(1), "Cantidad"), "mucho");

    expect(isMarked(control(ingredient(1), "Cantidad"))).toBe(true);
  });

  it("deletes an ingredient with one tap and no confirmation", () => {
    const confirm = vi.spyOn(window, "confirm");
    render(<SheetForm sheet={SHEET} />);

    fireEvent.click(within(ingredient(1)).getByRole("button", { name: "Eliminar" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Ingrediente 2" })).toBeNull();
    expect(control(ingredient(1), "Nombre").value).toBe("un puñado de cebollino");
    // The marks follow the new position.
    expect(markedFields()).toEqual(["ingredients.0.quantity", "ingredients.0.unit"]);
  });

  it("adds an empty ingredient at the end, marked as missing", () => {
    render(<SheetForm sheet={SHEET} />);

    fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));

    const third = ingredient(3);
    expect(control(third, "Nombre").value).toBe("");
    expect(control(third, "Cantidad").value).toBe("");
    expect(control(third, "Unidad").value).toBe("");
    expect(control(third, "Estimado").checked).toBe(false);
    expect(markedFields()).toEqual([
      "ingredients.1.quantity",
      "ingredients.1.unit",
      "ingredients.2.name",
      "ingredients.2.quantity",
      "ingredients.2.unit",
    ]);
  });

  it("keeps the focused field when a row above it is deleted", () => {
    // Rows are keyed by ingredient id: keyed by position, React would remove the
    // last row's elements instead, and the focus would be lost.
    render(<SheetForm sheet={SHEET} />);
    const focused = control(ingredient(2), "Cantidad");
    focused.focus();

    fireEvent.click(within(ingredient(1)).getByRole("button", { name: "Eliminar" }));

    expect(control(ingredient(1), "Cantidad")).toBe(focused);
    expect(document.activeElement).toBe(focused);
  });

  it("starts with no rows for a sheet without ingredients, and can add one", () => {
    render(<SheetForm sheet={{ ...SHEET, ingredients: [] }} />);

    expect(screen.queryByRole("group", { name: "Ingrediente 1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
    expect(ingredient(1)).toBeDefined();
  });
});
