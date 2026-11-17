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

/** A closed or open line: the button whose name starts with "Editar <what>". */
const line = (what: string) => screen.getByRole("button", { name: new RegExp(`^Editar ${what}`) });
const isOpen = (button: HTMLElement) => button.getAttribute("aria-expanded") === "true";

const group = (name: string) => screen.getByRole("group", { name });
const ingredient = (position: number) => group(`Ingrediente ${position}`);
const control = (container: HTMLElement, label: string) =>
  within(container).getByLabelText(label) as HTMLInputElement & HTMLSelectElement;

/** The only "Nombre" field on screen: one line is open at a time. */
const nameField = () => screen.getByLabelText("Nombre") as HTMLInputElement;
const done = () => screen.getByRole("button", { name: "Listo" });
const addButton = () => screen.getByRole("button", { name: "Añadir ingrediente" });

/** The `name` of every field marked with "Falta", in page order. */
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

describe("SheetForm, read like the saved sheet (04-C5, 09-C8)", () => {
  it("shows every line closed, as a button that names what it opens", () => {
    renderForm();

    expect(line("nombre").textContent).toContain("Tartar de atún");
    expect(screen.getByRole("heading", { level: 1 }).contains(line("nombre"))).toBe(true);
    expect(line("rendimiento").textContent).toContain("2,5 kg");
    expect(line("raciones").textContent).toContain("30 raciones");
    expect(line("atún rojo").textContent).toContain("1500 g");
    expect(line("un puñado de cebollino")).toBeDefined();
    for (const what of ["nombre", "rendimiento", "raciones", "atún rojo", "un puñado"]) {
      expect(line(what).getAttribute("aria-expanded")).toBe("false");
    }
    expect(screen.queryAllByRole("textbox")).toEqual([]);
  });

  it("shows estimated values with ≈, read as estimado", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: "Editar rendimiento: 2,5 kg (estimado)" }),
    ).toBeDefined();
    expect(line("rendimiento").querySelector(".estimated")?.textContent).toContain("≈");
  });

  it("marks exactly the missing values of the returned sheet on the closed lines", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: "Editar un puñado de cebollino Falta" }),
    ).toBeDefined();
    expect(screen.getAllByText("Falta")).toHaveLength(1);
  });

  it("marks the missing fields of an open line", () => {
    renderForm();
    fireEvent.click(line("un puñado"));

    expect(markedFields()).toEqual(["ingredients.1.quantity", "ingredients.1.unit"]);
    expect(isMarked(control(ingredient(2), "Cantidad"))).toBe(true);
    expect(isMarked(control(ingredient(2), "Unidad"))).toBe(true);
  });

  it("does not render a form that submits and reloads the page", () => {
    renderForm();

    // fireEvent returns false when the default action was prevented.
    expect(fireEvent.submit(screen.getByRole("form", { name: "Ficha" }))).toBe(false);
  });
});

describe("opening a line (09-C8)", () => {
  it("shows the ingredient's fields and moves the focus to its name", () => {
    renderForm();

    fireEvent.click(line("atún rojo"));

    expect(isOpen(line("atún rojo"))).toBe(true);
    const first = ingredient(1);
    expect(control(first, "Nombre").value).toBe("atún rojo");
    expect(control(first, "Cantidad").value).toBe("1500");
    expect(control(first, "Unidad").value).toBe("g");
    expect(control(first, "Estimado").checked).toBe(false);
    expect(document.activeElement).toBe(control(first, "Nombre"));
  });

  it("closes with Listo and gives the focus back to the line", () => {
    renderForm();
    fireEvent.click(line("atún rojo"));

    fireEvent.click(done());

    expect(isOpen(line("atún rojo"))).toBe(false);
    expect(screen.queryByRole("group", { name: "Ingrediente 1" })).toBeNull();
    expect(document.activeElement).toBe(line("atún rojo"));
  });

  it("keeps one line open: opening another closes the first and keeps its edits", () => {
    renderForm();
    fireEvent.click(line("atún rojo"));
    type(control(ingredient(1), "Cantidad"), "1,2");
    type(control(ingredient(1), "Unidad"), "kg");

    fireEvent.click(line("un puñado"));

    expect(isOpen(line("atún rojo"))).toBe(false);
    expect(isOpen(line("un puñado"))).toBe(true);
    expect(screen.queryByRole("group", { name: "Ingrediente 1" })).toBeNull();
    expect(line("atún rojo").textContent).toContain("1,2 kg");
    expect(document.activeElement).toBe(control(ingredient(2), "Nombre"));
  });

  it("opens the name, the yield and the covers the same way", () => {
    renderForm();

    fireEvent.click(line("nombre"));
    expect(isOpen(line("nombre"))).toBe(true);
    expect(nameField().value).toBe("Tartar de atún");
    expect(document.activeElement).toBe(nameField());

    fireEvent.click(line("rendimiento"));
    expect(isOpen(line("nombre"))).toBe(false);
    expect(control(group("Rendimiento"), "Cantidad").value).toBe("2,5");
    expect(control(group("Rendimiento"), "Unidad").value).toBe("kg");
    expect(control(group("Rendimiento"), "Estimado").checked).toBe(true);
    expect(document.activeElement).toBe(control(group("Rendimiento"), "Cantidad"));

    fireEvent.click(line("raciones"));
    expect(control(group("Raciones"), "Cantidad").value).toBe("30");
    expect(control(group("Raciones"), "Estimado").checked).toBe(false);
    expect(document.activeElement).toBe(control(group("Raciones"), "Cantidad"));

    fireEvent.click(done());
    expect(document.activeElement).toBe(line("raciones"));
  });

  it("closes the open line when its own button is tapped again", () => {
    renderForm();
    fireEvent.click(line("atún rojo"));

    fireEvent.click(line("atún rojo"));

    expect(isOpen(line("atún rojo"))).toBe(false);
  });

  it("uses the decimal keyboard for quantities and the numeric one for covers", () => {
    renderForm();

    fireEvent.click(line("rendimiento"));
    expect(control(group("Rendimiento"), "Cantidad").getAttribute("inputmode")).toBe("decimal");
    fireEvent.click(line("atún rojo"));
    expect(control(ingredient(1), "Cantidad").getAttribute("inputmode")).toBe("decimal");
    fireEvent.click(line("raciones"));
    expect(control(group("Raciones"), "Cantidad").getAttribute("inputmode")).toBe("numeric");
  });

  it("offers an empty option and the five units", () => {
    renderForm();
    fireEvent.click(line("atún rojo"));

    const options = Array.from(control(ingredient(1), "Unidad").options).map((o) => o.value);
    expect(options).toEqual(["", "g", "kg", "ml", "l", "ud"]);
  });
});

describe("editing (04-C6, 09-C8)", () => {
  it("changes the name, the yield and the covers", () => {
    renderForm();

    fireEvent.click(line("nombre"));
    type(nameField(), "Tartar");
    fireEvent.click(line("rendimiento"));
    type(control(group("Rendimiento"), "Cantidad"), "0,");
    type(control(group("Rendimiento"), "Unidad"), "l");
    fireEvent.click(control(group("Rendimiento"), "Estimado"));
    // The half-typed decimal comma stays while the line is open.
    expect(control(group("Rendimiento"), "Cantidad").value).toBe("0,");
    fireEvent.click(line("raciones"));
    type(control(group("Raciones"), "Cantidad"), "40");
    fireEvent.click(control(group("Raciones"), "Estimado"));
    fireEvent.click(done());

    expect(line("nombre").textContent).toContain("Tartar");
    expect(line("rendimiento").textContent).toContain("l · falta la cantidad");
    expect(
      screen.getByRole("button", { name: "Editar raciones: 40 raciones (estimado)" }),
    ).toBeDefined();
  });

  it("changes each field of one ingredient", () => {
    renderForm();
    fireEvent.click(line("un puñado"));
    const second = ingredient(2);

    type(control(second, "Nombre"), "cebollino");
    type(control(second, "Cantidad"), "20,5");
    type(control(second, "Unidad"), "g");
    fireEvent.click(control(second, "Estimado"));

    expect(control(second, "Nombre").value).toBe("cebollino");
    expect(control(second, "Cantidad").value).toBe("20,5");
    expect(control(second, "Unidad").value).toBe("g");
    expect(control(second, "Estimado").checked).toBe(true);
    fireEvent.click(done());
    expect(
      screen.getByRole("button", { name: "Editar cebollino 20,5 g (estimado)" }),
    ).toBeDefined();
    expect(line("atún rojo")).toBeDefined();
  });

  it("updates the marks as values change, open or closed", () => {
    renderForm();
    fireEvent.click(line("un puñado"));

    type(control(ingredient(2), "Cantidad"), "20");
    type(control(ingredient(2), "Unidad"), "g");
    expect(markedFields()).toEqual([]);
    expect(screen.queryByText("Falta")).toBeNull();

    fireEvent.click(line("raciones"));
    type(control(group("Raciones"), "Cantidad"), "");
    expect(markedFields()).toEqual(["covers"]);
    expect(isMarked(control(group("Raciones"), "Cantidad"))).toBe(true);

    fireEvent.click(line("nombre"));
    type(nameField(), " ");
    expect(isMarked(nameField())).toBe(true);
    fireEvent.click(done());
    expect(screen.getByRole("button", { name: "Editar nombre: Sin nombre Falta" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Editar raciones: Raciones Falta" })).toBeDefined();
  });

  it("marks a quantity that is not a number", () => {
    renderForm();
    fireEvent.click(line("atún rojo"));

    type(control(ingredient(1), "Cantidad"), "mucho");

    expect(isMarked(control(ingredient(1), "Cantidad"))).toBe(true);
    fireEvent.click(done());
    expect(line("atún rojo").textContent).toContain("falta la cantidad");
  });
});

describe("adding and deleting (09-C8)", () => {
  it("adds an empty line at the end, already open, with its name focused", () => {
    renderForm();

    fireEvent.click(addButton());

    const third = ingredient(3);
    expect(control(third, "Nombre").value).toBe("");
    expect(control(third, "Cantidad").value).toBe("");
    expect(control(third, "Unidad").value).toBe("");
    expect(control(third, "Estimado").checked).toBe(false);
    expect(document.activeElement).toBe(control(third, "Nombre"));
    expect(markedFields()).toEqual([
      "ingredients.2.name",
      "ingredients.2.quantity",
      "ingredients.2.unit",
    ]);
  });

  it("keeps an empty line findable once closed, with its marks", () => {
    renderForm();
    fireEvent.click(addButton());

    fireEvent.click(done());

    expect(screen.getByRole("button", { name: "Editar Sin nombre Falta Falta" })).toBeDefined();
  });

  it("closes the open line when another one is added", () => {
    renderForm();
    fireEvent.click(line("atún rojo"));

    fireEvent.click(addButton());

    expect(isOpen(line("atún rojo"))).toBe(false);
    expect(ingredient(3)).toBeDefined();
  });

  it("deletes with one tap and no confirmation, and focuses the next line", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderForm();
    fireEvent.click(line("atún rojo"));

    fireEvent.click(within(ingredient(1)).getByRole("button", { name: "Eliminar" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Editar atún rojo/ })).toBeNull();
    expect(screen.queryByRole("group", { name: /^Ingrediente/ })).toBeNull();
    expect(document.activeElement).toBe(line("un puñado"));
  });

  it("focuses Añadir ingrediente after deleting the last line", () => {
    renderForm();
    fireEvent.click(line("un puñado"));

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(document.activeElement).toBe(addButton());
  });

  it("starts with no lines for a sheet without ingredients, and can add one", () => {
    renderForm({ ...SHEET, ingredients: [] });

    expect(
      screen.queryByRole("button", { name: /^Editar (?!nombre|rendimiento|raciones)/ }),
    ).toBeNull();

    fireEvent.click(addButton());
    expect(ingredient(1)).toBeDefined();
  });
});

describe("Confirmar (05-C1, 09-C8)", () => {
  const confirmButton = () => screen.getByRole("button", { name: /Confirmar|Guardando…/ });
  const isDisabled = () => confirmButton().hasAttribute("disabled");
  const HINT = "Escribe el nombre de la preparación y de cada ingrediente para confirmar.";

  it("is at the bottom of the sheet, enabled for a complete sheet", () => {
    renderForm();

    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toBe(confirmButton());
    expect(confirmButton().textContent).toBe("Confirmar ficha");
    expect(isDisabled()).toBe(false);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("sends the edited sheet with a line still open", () => {
    const { onConfirm } = renderForm();
    fireEvent.click(line("nombre"));
    type(nameField(), " Tartar ");
    fireEvent.click(line("rendimiento"));
    type(control(group("Rendimiento"), "Cantidad"), "3,5");
    fireEvent.click(line("un puñado"));
    type(control(ingredient(2), "Cantidad"), "20");
    type(control(ingredient(2), "Unidad"), "g");

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      ...SHEET,
      name: "Tartar",
      yield: { ...SHEET.yield, quantity: 3.5 },
      ingredients: [SHEET.ingredients[0], { ...SHEET.ingredients[1], quantity: 20, unit: "g" }],
    });
  });

  it("sends the same sheet with every line closed", () => {
    const { onConfirm } = renderForm();
    fireEvent.click(line("un puñado"));
    type(control(ingredient(2), "Cantidad"), "20");
    fireEvent.click(done());

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      ...SHEET,
      ingredients: [SHEET.ingredients[0], { ...SHEET.ingredients[1], quantity: 20 }],
    });
  });

  it("can be confirmed with missing data", () => {
    const { onConfirm } = renderForm();
    fireEvent.click(line("raciones"));
    type(control(group("Raciones"), "Cantidad"), "");

    fireEvent.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm.mock.calls[0][0].covers.value).toBeNull();
  });

  it("is disabled with a hint while the name is empty, open or closed", () => {
    const { onConfirm } = renderForm();
    fireEvent.click(line("nombre"));
    type(nameField(), "  ");

    expect(isDisabled()).toBe(true);
    expect(screen.getByText(HINT)).toBeDefined();
    fireEvent.click(done());
    expect(isDisabled()).toBe(true);
    fireEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(line("nombre"));
    type(nameField(), "Tartar");
    expect(isDisabled()).toBe(false);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("is disabled while an ingredient has no name, such as a line just added", () => {
    renderForm();
    fireEvent.click(addButton());

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

  it("shows the error and keeps the edits and the open line", () => {
    const { rerender } = renderForm();
    fireEvent.click(line("nombre"));
    type(nameField(), "Tartar editado");

    rerender({ confirming: true });
    rerender({ confirming: false, confirmError: "No se ha podido guardar la ficha." });

    expect(screen.getByRole("alert").textContent).toBe("No se ha podido guardar la ficha.");
    expect(isOpen(line("nombre"))).toBe(true);
    expect(nameField().value).toBe("Tartar editado");
    expect(isDisabled()).toBe(false);
  });

  it("does not confirm when the keyboard submits the form", () => {
    const { onConfirm } = renderForm();

    fireEvent.submit(screen.getByRole("form", { name: "Ficha" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
