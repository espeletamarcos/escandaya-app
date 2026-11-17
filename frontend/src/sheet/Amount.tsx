import type { ReactNode } from "react";
import EstimatedMark from "../ui/EstimatedMark";
import { NUMBER } from "./numbers";
import type { Unit } from "./types";
import "./Amount.css";

/** The "Falta" mark, in marker red. An `id` links it to its field for screen readers. */
export function Missing({ children = "Falta", id }: { children?: ReactNode; id?: string }) {
  return (
    <span id={id} className="sheet-missing">
      {children}
    </span>
  );
}

/**
 * A quantity and its unit, as the chef reads them. A missing part is marked: both
 * missing is "Falta", one missing says which. An estimated amount gets its "≈".
 * `missing` holds the sheet's missing paths, such as "ingredients.1.unit".
 */
export function Amount({
  quantity,
  unit,
  estimated,
  path,
  missing,
}: {
  quantity: number | null;
  unit: Unit | null;
  estimated: boolean;
  path: string;
  missing: Set<string>;
}) {
  const quantityMissing = missing.has(`${path}.quantity`);
  const unitMissing = missing.has(`${path}.unit`);
  if (quantityMissing && unitMissing) return <Missing />;
  if (quantityMissing) {
    return (
      <>
        {unit} · <Missing>falta la cantidad</Missing>
      </>
    );
  }
  if (unitMissing) {
    return (
      <>
        {NUMBER.format(quantity ?? 0)} · <Missing>falta la unidad</Missing>
      </>
    );
  }
  const text = `${NUMBER.format(quantity ?? 0)} ${unit}`;
  return estimated ? <EstimatedMark>{text}</EstimatedMark> : <>{text}</>;
}
