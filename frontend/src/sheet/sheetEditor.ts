// Editing the sheet: pure functions, tested without React.
// Numbers are kept as the text the chef types, so "0," survives while typing a
// decimal comma; they are only read as numbers to decide what to mark.

import type { Sheet, Unit } from "./types";

/** A unit, or "" for the empty option of the select. */
export type EditableUnit = Unit | "";

export interface EditableIngredient {
  /** Client-side only, for stable React keys. Never sent to the backend. */
  id: number;
  name: string;
  quantity: string;
  unit: EditableUnit;
  estimated: boolean;
}

export interface EditableSheet {
  name: string;
  yield: { quantity: string; unit: EditableUnit; estimated: boolean };
  covers: { value: string; estimated: boolean };
  ingredients: EditableIngredient[];
  /** The id the next added ingredient gets; ids are never reused. */
  nextId: number;
}

export type SheetEdit =
  | { type: "name"; value: string }
  | { type: "yield"; changes: Partial<EditableSheet["yield"]> }
  | { type: "covers"; changes: Partial<EditableSheet["covers"]> }
  | { type: "ingredient"; id: number; changes: Partial<Omit<EditableIngredient, "id">> }
  | { type: "add-ingredient" }
  | { type: "delete-ingredient"; id: number };

/** Spanish style: 2.5 is shown as "2,5". */
function numberText(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

export function toEditable(sheet: Sheet): EditableSheet {
  return {
    name: sheet.name,
    yield: {
      quantity: numberText(sheet.yield.quantity),
      unit: sheet.yield.unit ?? "",
      estimated: sheet.yield.estimated,
    },
    covers: { value: numberText(sheet.covers.value), estimated: sheet.covers.estimated },
    ingredients: sheet.ingredients.map((item, index) => ({
      id: index + 1,
      name: item.name,
      quantity: numberText(item.quantity),
      unit: item.unit ?? "",
      estimated: item.estimated,
    })),
    nextId: sheet.ingredients.length + 1,
  };
}

// Digits with at most one comma or dot: "2", "2,5", "2.5", ",5", and "2," while typing.
// No signs, exponents or thousands separators.
const DECIMAL = /^(\d+([.,]\d*)?|[.,]\d+)$/;
const WHOLE = /^\d+$/;

/** A quantity as typed, with a comma or a dot: a number > 0, or null. */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return null;
  const value = Number(trimmed.replace(",", "."));
  return value > 0 ? value : null;
}

/** Covers as typed: a whole number > 0, or null. */
export function parseCovers(text: string): number | null {
  const trimmed = text.trim();
  if (!WHOLE.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

/** Apply one edit, returning a new sheet. The given sheet is not changed. */
export function editSheet(sheet: EditableSheet, edit: SheetEdit): EditableSheet {
  switch (edit.type) {
    case "name":
      return { ...sheet, name: edit.value };
    case "yield":
      return { ...sheet, yield: { ...sheet.yield, ...edit.changes } };
    case "covers":
      return { ...sheet, covers: { ...sheet.covers, ...edit.changes } };
    case "ingredient":
      return {
        ...sheet,
        ingredients: sheet.ingredients.map((item) =>
          item.id === edit.id ? { ...item, ...edit.changes } : item,
        ),
      };
    case "add-ingredient":
      return {
        ...sheet,
        ingredients: [
          ...sheet.ingredients,
          { id: sheet.nextId, name: "", quantity: "", unit: "", estimated: false },
        ],
        nextId: sheet.nextId + 1,
      };
    case "delete-ingredient":
      return { ...sheet, ingredients: sheet.ingredients.filter((item) => item.id !== edit.id) };
  }
}

/**
 * Paths of the fields to mark as "Falta", in display order: empty, or not readable
 * as a number. Display only: the backend recomputes the missing data on confirm.
 * On a sheet just returned by the backend this equals its `missing` list, plus the
 * names, which a valid sheet always has.
 */
export function emptyFields(sheet: EditableSheet): string[] {
  const empty: string[] = [];
  if (!sheet.name.trim()) empty.push("name");
  if (parseQuantity(sheet.yield.quantity) === null) empty.push("yield.quantity");
  if (sheet.yield.unit === "") empty.push("yield.unit");
  if (parseCovers(sheet.covers.value) === null) empty.push("covers");
  sheet.ingredients.forEach((item, index) => {
    if (!item.name.trim()) empty.push(`ingredients.${index}.name`);
    if (parseQuantity(item.quantity) === null) empty.push(`ingredients.${index}.quantity`);
    if (item.unit === "") empty.push(`ingredients.${index}.unit`);
  });
  return empty;
}
