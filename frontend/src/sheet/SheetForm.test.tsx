import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SheetForm, { type SheetFormProps } from "./SheetForm";
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

/** The form with the confirm props filled in; `props` overrides them. */
function renderForm(sheet: Sheet = SHEET, props: Partial<SheetFormProps> = {}) {
  const onConfirm = vi.fn<SheetFormProps["onConfirm"]>();
  const all = (more: Partial<SheetFormProps>): SheetFormProps => ({
    sheet,
    onConfirm,
    confirming: false,
    confirmError: null,
    ...props,
    ...more,
  });
  const { rerender } = render(<SheetForm {...all({})} />);
  return {
    onConfirm,
    rerender: (more: Partial<SheetFormProps>) => rerender(<SheetForm {...all(more)} />),
  };
}

describe("SheetForm (04-C5)", () => {
  it("shows the sheet's values in labelled fields", () => {
    renderForm();

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
    renderForm();

    expect(control(group("Rendimiento"), "Estimado").checked).toBe(true);
    expect(control(group("Raciones"), "Estimado").checked).toBe(false);
    expect(control(ingredient(1), "Estimado").checked).toBe(false);
  });

  it("uses the decimal keyboard for quantities and the numeric one for covers", () => {
    renderForm();

    expect(control(group("Rendimiento"), "Cantidad").getAttribute("inputmode")).toBe("decimal");
    expect(control(ingredient(1), "Cantidad").getAttribute("inputmode")).toBe("decimal");
    expect(control(group("Raciones"), "Cantidad").getAttribute("inputmode")).toBe("numeric");
  });

  it("offers an empty option and the five units", () => {
    renderForm();

    const options = Array.from(control(ingredient(1), "Unidad").options).map((o) => o.value);
    expect(options).toEqual(["", "g", "kg", "ml", "l", "ud"]);
  });

  it("marks exactly the missing fields of the returned sheet", () => {
    renderForm();

    expect(markedFields()).toEqual(["ingredients.1.quantity", "ingredients.1.unit"]);
    expect(isMarked(control(ingredient(2), "Cantidad"))).toBe(true);
    expect(isMarked(control(ingredient(2), "Unidad"))).toBe(true);
    expect(screen.getAllByText("Falta")).toHaveLength(2);
  });

  it("does not render a form that submits and reloads the page", () => {
    renderForm();

    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.submit(screen.getByRole("form", { name: "Ficha" }))).toBe(false);
  });
});

describe("editing (04-C6)", () => {
  it("changes the name, the yield and the covers", () => {
    renderForm();

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
    renderForm();
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
    renderForm();

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
    renderForm();

    type(control(ingredient(1), "Cantidad"), "mucho");

    expect(isMarked(control(ingredient(1), "Cantidad"))).toBe(true);
  });

  it("deletes an ingredient with one tap and no confirmation", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderForm();

    fireEvent.click(within(ingredient(1)).getByRole("button", { name: "Eliminar" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Ingrediente 2" })).toBeNull();
    expect(control(ingredient(1), "Nombre").value).toBe("un puñado de cebollino");
    // The marks follow the new position.
    expect(markedFields()).toEqual(["ingredients.0.quantity", "ingredients.0.unit"]);
  });

  it("adds an empty ingredient at the end, marked as missing", () => {
    renderForm();

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
    renderForm();
    const focused = control(ingredient(2), "Cantidad");
    focused.focus();

    fireEvent.click(within(ingredient(1)).getByRole("button", { name: "Eliminar" }));

    expect(control(ingredient(1), "Cantidad")).toBe(focused);
    expect(document.activeElement).toBe(focused);
  });

  it("starts with no rows for a sheet without ingredients, and can add one", () => {
    renderForm({ ...SHEET, ingredients: [] });

    expect(screen.queryByRole("group", { name: "Ingrediente 1" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));
    expect(ingredient(1)).toBeDefined();
  });
});

describe("Confirmar (05-C1)", () => {
  const confirmButton = () => screen.getByRole("button", { name: /Confirmar|Guardando…/ });
  const isDisabled = () => confirmButton().hasAttribute("disabled");
  const HINT = "Escribe el nombre de la preparación y de cada ingrediente para confirmar.";

  it("is at the bottom of the sheet, enabled for a complete sheet", () => {
    renderForm();

    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toBe(confirmButton());
    expect(confirmButton().textContent).toBe("Confirmar");
    expect(isDisabled()).toBe(false);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("sends the edited sheet, read back from the form", () => {
    const { onConfirm } = renderForm();
    type(sheetName(), " Tartar ");
    type(control(group("Rendimiento"), "Cantidad"), "3,5");
    type(control(ingredient(2), "Cantidad"), "20");
    fireEvent.change(control(ingredient(2), "Unidad"), { target: { value: "g" } });

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      ...SHEET,
      name: "Tartar",
      yield: { ...SHEET.yield, quantity: 3.5 },
      ingredients: [SHEET.ingredients[0], { ...SHEET.ingredients[1], quantity: 20, unit: "g" }],
    });
  });

  it("can be confirmed with missing data", () => {
    const { onConfirm } = renderForm();
    type(control(group("Raciones"), "Cantidad"), "");

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0].covers.value).toBeNull();
  });

  it("is disabled with a hint while the name is empty", () => {
    const { onConfirm } = renderForm();
    type(sheetName(), "  ");

    expect(isDisabled()).toBe(true);
    expect(screen.getByText(HINT)).toBeDefined();
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();

    type(sheetName(), "Tartar");
    expect(isDisabled()).toBe(false);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("is disabled while an ingredient has no name, such as a row just added", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Añadir ingrediente" }));

    expect(isDisabled()).toBe(true);
    expect(screen.getByText(HINT)).toBeDefined();

    type(control(ingredient(3), "Nombre"), "sal");
    expect(isDisabled()).toBe(false);
  });

  it("shows Guardando… and is disabled while confirming", () => {
    const { onConfirm } = renderForm(SHEET, { confirming: true });

    expect(confirmButton().textContent).toBe("Guardando…");
    expect(isDisabled()).toBe(true);
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows the error and keeps the edits", () => {
    const { rerender } = renderForm();
    type(sheetName(), "Tartar editado");

    rerender({ confirming: true });
    rerender({ confirming: false, confirmError: "No se ha podido guardar la ficha." });

    expect(screen.getByRole("alert").textContent).toBe("No se ha podido guardar la ficha.");
    expect(sheetName().value).toBe("Tartar editado");
    expect(isDisabled()).toBe(false);
  });

  it("does not confirm when the keyboard submits the form", () => {
    const { onConfirm } = renderForm();

    fireEvent.submit(screen.getByRole("form", { name: "Ficha" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
