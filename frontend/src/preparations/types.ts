// Saved preparations as the backend returns them from /api/preparations (spec 05).
// JSON names are kept as they are (`confirmed_at`, `missing_count`), so no mapping is needed.

import type { Sheet } from "../sheet/types";

/** One preparation in full: POST /api/preparations and GET /api/preparations/{id}. */
export interface SavedPreparation {
  id: number;
  /** ISO 8601 in UTC, such as "2026-11-14T12:30:00Z". */
  confirmed_at: string;
  sheet: Sheet;
  /** Paths such as "covers" or "ingredients.2.quantity", computed by the backend. */
  missing: string[];
}

/** One line of the list: GET /api/preparations, newest first. */
export interface PreparationSummary {
  id: number;
  name: string;
  covers: number | null;
  missing_count: number;
  confirmed_at: string;
}

/** What "Confirmar" sends. The missing data is never sent: the backend computes it. */
export interface ConfirmInput {
  /** Made once per sheet, so sending the same sheet again saves it once. */
  confirmId: string;
  transcript: string;
  sheet: Sheet;
}
