import { describe, expect, it } from "vitest";
import {
  canConfirm,
  type EditableSheet,
  editSheet,
  emptyFields,
  parseCovers,
  parseQuantity,
  toEditable,
  toSheet,
} from "./sheetEditor";
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

describe("parseQuantity (04-C6)", () => {
  it.each<[string, number]>([
    ["2", 2],
    ["1500", 1500],
    ["2,5", 2.5],
    ["2.5", 2.5],
    ["0,25", 0.25],
    [",5", 0.5],
    // Halfway through typing "2,5".
    ["2,", 2],
    ["  3 ", 3],
  ])("reads %j as %d", (text, value) => {
    expect(parseQuantity(text)).toBe(value);
  });

  it.each(["", "   ", "0", "0,0", "-1", "abc", "2 kg", "1,2,3", "1.000,5", "1e3", ",", "Infinity"])(
    "rejects %j",
    (text) => {
      expect(parseQuantity(text)).toBeNull();
    },
  );
});

describe("parseCovers", () => {
  it.each<[string, number]>([
    ["30", 30],
    [" 4 ", 4],
  ])("reads %j as %d", (text, value) => {
    expect(parseCovers(text)).toBe(value);
  });

  it.each(["", "0", "-2", "2,5", "2.5", "treinta"])("rejects %j", (text) => {
    expect(parseCovers(text)).toBeNull();
  });
});

describe("toEditable (04-C5)", () => {
  it("turns numbers into text with a decimal comma, and empty values into empty text", () => {
    const editable = toEditable(SHEET);

    expect(editable.name).toBe("Tartar de atún");
    expect(editable.yield).toEqual({ quantity: "2,5", unit: "kg", estimated: true });
    expect(editable.covers).toEqual({ value: "30", estimated: false });
    expect(editable.ingredients).toEqual([
      { id: expect.any(Number), name: "atún rojo", quantity: "1500", unit: "g", estimated: false },
      {
        id: expect.any(Number),
        name: "un puñado de cebollino",
        quantity: "",
        unit: "",
        estimated: false,
      },
      { id: expect.any(Number), name: "aceite", quantity: "0,25", unit: "l", estimated: true },
    ]);
  });

  it("gives each ingredient its own id", () => {
    const ids = toEditable(SHEET).ingredients.map((item) => item.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("reads back the numbers it wrote", () => {
    const editable = toEditable(SHEET);

    expect(parseQuantity(editable.yield.quantity)).toBe(2.5);
    expect(editable.ingredients.map((item) => parseQuantity(item.quantity))).toEqual([
      1500,
      null,
      0.25,
    ]);
  });

  it("handles a sheet with nothing filled in", () => {
    const editable = toEditable({
      name: "Fondo",
      yield: { quantity: null, unit: null, estimated: false },
      covers: { value: null, estimated: false },
      ingredients: [],
    });

    expect(editable.yield).toEqual({ quantity: "", unit: "", estimated: false });
    expect(editable.covers).toEqual({ value: "", estimated: false });
    expect(editable.ingredients).toEqual([]);
  });
});

describe("editSheet (04-C6)", () => {
  const start = () => toEditable(SHEET);
  const idAt = (sheet: EditableSheet, index: number) => sheet.ingredients[index].id;

  it("changes the name", () => {
    expect(editSheet(start(), { type: "name", value: "Tartar" }).name).toBe("Tartar");
  });

  it("changes the yield quantity, unit and estimated flag", () => {
    let sheet = start();
    sheet = editSheet(sheet, { type: "yield", changes: { quantity: "0," } });
    sheet = editSheet(sheet, { type: "yield", changes: { unit: "l" } });
    sheet = editSheet(sheet, { type: "yield", changes: { estimated: false } });

    // "0," survives: the text is kept as typed.
    expect(sheet.yield).toEqual({ quantity: "0,", unit: "l", estimated: false });
  });

  it("changes the covers and their estimated flag", () => {
    let sheet = start();
    sheet = editSheet(sheet, { type: "covers", changes: { value: "40" } });
    sheet = editSheet(sheet, { type: "covers", changes: { estimated: true } });

    expect(sheet.covers).toEqual({ value: "40", estimated: true });
  });

  it("changes each field of one ingredient only", () => {
    let sheet = start();
    const id = idAt(sheet, 1);
    sheet = editSheet(sheet, { type: "ingredient", id, changes: { name: "cebollino" } });
    sheet = editSheet(sheet, { type: "ingredient", id, changes: { quantity: "20" } });
    sheet = editSheet(sheet, { type: "ingredient", id, changes: { unit: "g" } });
    sheet = editSheet(sheet, { type: "ingredient", id, changes: { estimated: true } });

    expect(sheet.ingredients[1]).toEqual({
      id,
      name: "cebollino",
      quantity: "20",
      unit: "g",
      estimated: true,
    });
    expect(sheet.ingredients[0]).toEqual(start().ingredients[0]);
    expect(sheet.ingredients[2]).toEqual(start().ingredients[2]);
  });

  it("can empty a unit", () => {
    const sheet = start();
    const edited = editSheet(sheet, { type: "ingredient", id: idAt(sheet, 0), changes: { unit: "" } });
    expect(edited.ingredients[0].unit).toBe("");
  });

  it("adds an empty ingredient at the end with a new id", () => {
    const sheet = start();

    const edited = editSheet(sheet, { type: "add-ingredient" });

    expect(edited.ingredients).toHaveLength(4);
    const added = edited.ingredients[3];
    expect(added).toEqual({ id: added.id, name: "", quantity: "", unit: "", estimated: false });
    expect(sheet.ingredients.map((item) => item.id)).not.toContain(added.id);
  });

  it("deletes one ingredient", () => {
    const sheet = start();

    const edited = editSheet(sheet, { type: "delete-ingredient", id: idAt(sheet, 1) });

    expect(edited.ingredients.map((item) => item.name)).toEqual(["atún rojo", "aceite"]);
  });

  it("never reuses the id of a deleted ingredient", () => {
    let sheet = start();
    const deleted = idAt(sheet, 2);
    sheet = editSheet(sheet, { type: "delete-ingredient", id: deleted });
    sheet = editSheet(sheet, { type: "add-ingredient" });

    expect(idAt(sheet, 2)).not.toBe(deleted);
  });

  it("adds to and deletes from an empty list", () => {
    let sheet = toEditable({ ...SHEET, ingredients: [] });
    sheet = editSheet(sheet, { type: "add-ingredient" });
    expect(sheet.ingredients).toHaveLength(1);

    sheet = editSheet(sheet, { type: "delete-ingredient", id: idAt(sheet, 0) });
    expect(sheet.ingredients).toEqual([]);
  });

  it("does not change the sheet it was given", () => {
    const sheet = start();
    const copy = structuredClone(sheet);

    editSheet(sheet, { type: "name", value: "Otro" });
    editSheet(sheet, { type: "yield", changes: { quantity: "9" } });
    editSheet(sheet, { type: "ingredient", id: idAt(sheet, 0), changes: { name: "x" } });
    editSheet(sheet, { type: "add-ingredient" });
    editSheet(sheet, { type: "delete-ingredient", id: idAt(sheet, 0) });

    expect(sheet).toEqual(copy);
  });
});

describe("emptyFields (04-C5, 04-C6)", () => {
  it("marks exactly what the backend marked as missing on a returned sheet", () => {
    // The backend's missing_fields gives these paths for SHEET.
    expect(emptyFields(toEditable(SHEET))).toEqual([
      "ingredients.1.quantity",
      "ingredients.1.unit",
    ]);
  });

  it("marks every empty field of a sheet with nothing filled in, in display order", () => {
    const sheet = toEditable({
      name: "Fondo",
      yield: { quantity: null, unit: null, estimated: false },
      covers: { value: null, estimated: false },
      ingredients: [{ name: "agua", quantity: null, unit: null, estimated: false }],
    });

    expect(emptyFields(sheet)).toEqual([
      "yield.quantity",
      "yield.unit",
      "covers",
      "ingredients.0.quantity",
      "ingredients.0.unit",
    ]);
  });

  it("removes a mark when the field is filled in, and adds it when it is emptied", () => {
    let sheet = toEditable(SHEET);
    const id = sheet.ingredients[1].id;

    sheet = editSheet(sheet, { type: "ingredient", id, changes: { quantity: "20", unit: "g" } });
    expect(emptyFields(sheet)).toEqual([]);

    sheet = editSheet(sheet, { type: "covers", changes: { value: "" } });
    expect(emptyFields(sheet)).toEqual(["covers"]);
  });

  it.each<[string, (sheet: EditableSheet) => EditableSheet, string]>([
    ["a blank name", (s) => editSheet(s, { type: "name", value: "  " }), "name"],
    [
      "a yield quantity that does not parse",
      (s) => editSheet(s, { type: "yield", changes: { quantity: "dos" } }),
      "yield.quantity",
    ],
    [
      "a zero yield quantity",
      (s) => editSheet(s, { type: "yield", changes: { quantity: "0" } }),
      "yield.quantity",
    ],
    [
      "an empty yield unit",
      (s) => editSheet(s, { type: "yield", changes: { unit: "" } }),
      "yield.unit",
    ],
    [
      "covers with decimals",
      (s) => editSheet(s, { type: "covers", changes: { value: "2,5" } }),
      "covers",
    ],
    [
      "a blank ingredient name",
      (s) => editSheet(s, { type: "ingredient", id: s.ingredients[0].id, changes: { name: "" } }),
      "ingredients.0.name",
    ],
    [
      "a negative ingredient quantity",
      (s) =>
        editSheet(s, { type: "ingredient", id: s.ingredients[2].id, changes: { quantity: "-1" } }),
      "ingredients.2.quantity",
    ],
  ])("marks %s", (_, edit, path) => {
    expect(emptyFields(edit(toEditable(SHEET)))).toContain(path);
  });

  it("marks every field of a new ingredient", () => {
    const sheet = editSheet(toEditable(SHEET), { type: "add-ingredient" });

    expect(emptyFields(sheet).filter((path) => path.startsWith("ingredients.3."))).toEqual([
      "ingredients.3.name",
      "ingredients.3.quantity",
      "ingredients.3.unit",
    ]);
  });

  it("follows the positions after a deletion", () => {
    let sheet = toEditable(SHEET);
    sheet = editSheet(sheet, { type: "delete-ingredient", id: sheet.ingredients[0].id });

    expect(emptyFields(sheet)).toEqual(["ingredients.0.quantity", "ingredients.0.unit"]);
  });

  it("does not mark an estimated value that is filled in", () => {
    const sheet = toEditable(SHEET);
    expect(sheet.yield.estimated).toBe(true);
    expect(emptyFields(sheet)).not.toContain("yield.quantity");
  });
});

describe("toSheet (05-C1)", () => {
  it("gives back the same sheet when nothing was edited", () => {
    expect(toSheet(toEditable(SHEET))).toEqual(SHEET);
  });

  it("reads the edited values, with a decimal comma", () => {
    let sheet = toEditable(SHEET);
    const id = sheet.ingredients[1].id;
    sheet = editSheet(sheet, { type: "yield", changes: { quantity: "3,5", unit: "l" } });
    sheet = editSheet(sheet, { type: "covers", changes: { value: "45", estimated: true } });
    sheet = editSheet(sheet, {
      type: "ingredient",
      id,
      changes: { name: "cebollino", quantity: "20", unit: "g", estimated: true },
    });

    const result = toSheet(sheet);

    expect(result.yield).toEqual({ quantity: 3.5, unit: "l", estimated: true });
    expect(result.covers).toEqual({ value: 45, estimated: true });
    expect(result.ingredients[1]).toEqual({
      name: "cebollino",
      quantity: 20,
      unit: "g",
      estimated: true,
    });
  });

  it("trims the names", () => {
    let sheet = toEditable(SHEET);
    const id = sheet.ingredients[0].id;
    sheet = editSheet(sheet, { type: "name", value: "  Tartar  " });
    sheet = editSheet(sheet, { type: "ingredient", id, changes: { name: " atún " } });

    const result = toSheet(sheet);

    expect(result.name).toBe("Tartar");
    expect(result.ingredients[0].name).toBe("atún");
  });

  it("sends empty fields as null: they are missing data", () => {
    let sheet = toEditable(SHEET);
    sheet = editSheet(sheet, { type: "yield", changes: { quantity: "", unit: "" } });
    sheet = editSheet(sheet, { type: "covers", changes: { value: "" } });

    const result = toSheet(sheet);

    expect(result.yield).toEqual({ quantity: null, unit: null, estimated: true });
    expect(result.covers).toEqual({ value: null, estimated: false });
  });

  it.each(["dos", "0", "-1", "1e3", "2,5,0"])(
    "sends a quantity that does not parse (%s) as null",
    (text) => {
      const sheet = editSheet(toEditable(SHEET), { type: "yield", changes: { quantity: text } });
      expect(toSheet(sheet).yield.quantity).toBeNull();
    },
  );

  it.each(["treinta", "0", "30,5", "-3"])("sends covers that do not parse (%s) as null", (text) => {
    const sheet = editSheet(toEditable(SHEET), { type: "covers", changes: { value: text } });
    expect(toSheet(sheet).covers.value).toBeNull();
  });

  it("keeps the order after adding and deleting ingredients", () => {
    let sheet = toEditable(SHEET);
    sheet = editSheet(sheet, { type: "delete-ingredient", id: sheet.ingredients[0].id });
    sheet = editSheet(sheet, { type: "add-ingredient" });
    const added = sheet.ingredients[2].id;
    sheet = editSheet(sheet, { type: "ingredient", id: added, changes: { name: "sal" } });

    expect(toSheet(sheet).ingredients.map((item) => item.name)).toEqual([
      "un puñado de cebollino",
      "aceite",
      "sal",
    ]);
  });

  it("does not send the client-side ids", () => {
    const [first] = toSheet(toEditable(SHEET)).ingredients;
    expect(Object.keys(first).sort()).toEqual(["estimated", "name", "quantity", "unit"]);
    expect(Object.keys(toSheet(toEditable(SHEET))).sort()).toEqual([
      "covers",
      "ingredients",
      "name",
      "yield",
    ]);
  });
});

describe("canConfirm (05-C1)", () => {
  it("allows a complete sheet", () => {
    expect(canConfirm(toEditable(SHEET))).toBe(true);
  });

  it("allows a sheet with missing quantities, units, yield and covers", () => {
    const sheet = toEditable({
      name: "Fondo",
      yield: { quantity: null, unit: null, estimated: false },
      covers: { value: null, estimated: false },
      ingredients: [{ name: "agua", quantity: null, unit: null, estimated: false }],
    });

    expect(canConfirm(sheet)).toBe(true);
  });

  it("allows a sheet without ingredients", () => {
    expect(canConfirm(toEditable({ ...SHEET, ingredients: [] }))).toBe(true);
  });

  it.each(["", "   "])("blocks a sheet whose name is %j", (name) => {
    expect(canConfirm(editSheet(toEditable(SHEET), { type: "name", value: name }))).toBe(false);
  });

  it("blocks a sheet with an ingredient without a name, such as a row just added", () => {
    const sheet = editSheet(toEditable(SHEET), { type: "add-ingredient" });
    expect(canConfirm(sheet)).toBe(false);
  });

  it("allows it again once the empty row is named or deleted", () => {
    const sheet = editSheet(toEditable(SHEET), { type: "add-ingredient" });
    const added = sheet.ingredients[3].id;

    const named = editSheet(sheet, { type: "ingredient", id: added, changes: { name: "sal" } });
    const deleted = editSheet(sheet, { type: "delete-ingredient", id: added });

    expect(canConfirm(named)).toBe(true);
    expect(canConfirm(deleted)).toBe(true);
  });
});
