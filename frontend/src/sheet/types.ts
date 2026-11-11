// The recipe sheet as the backend returns it from POST /api/drafts.
// JSON names are kept as they are (`is_preparation`, `yield`), so no mapping is needed.

/** The fixed list of units, in display order. Same list as `Unit` in sheets.py. */
export const UNITS = ["g", "kg", "ml", "l", "ud"] as const;

export type Unit = (typeof UNITS)[number];

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  estimated: boolean;
}

export interface Sheet {
  name: string;
  yield: {
    quantity: number | null;
    unit: Unit | null;
    estimated: boolean;
  };
  covers: {
    value: number | null;
    estimated: boolean;
  };
  ingredients: Ingredient[];
}

/**
 * What the backend made of the transcript. `missing` holds paths such as
 * "yield.unit", "covers" or "ingredients.2.quantity", computed by the backend.
 */
export type Draft =
  | { is_preparation: true; sheet: Sheet; missing: string[] }
  | { is_preparation: false; sheet: null; missing: string[] };
