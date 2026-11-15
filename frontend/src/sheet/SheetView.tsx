import type { ReactNode } from "react";
import type { Sheet, Unit } from "./types";

// Spanish style: 2,5 and 0,25. Up to three decimals, enough for 0,125 kg.
const NUMBER = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });

function Missing({ children = "Falta" }: { children?: ReactNode }) {
  return <span className="sheet-missing">{children}</span>;
}

const ESTIMATED = " (estimado)";

/**
 * A quantity and its unit, as the chef reads them. A missing part is marked: both
 * missing is "Falta", one missing says which.
 */
function Amount({
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
  return (
    <>
      {NUMBER.format(quantity ?? 0)} {unit}
      {estimated && ESTIMATED}
    </>
  );
}

interface SheetViewProps {
  sheet: Sheet;
  /** The backend's missing data paths ("covers", "ingredients.1.unit"…): the marks. */
  missing: string[];
}

/** A saved sheet, read-only. The marks come from the backend, never from the phone. */
function SheetView({ sheet, missing }: SheetViewProps) {
  const marked = new Set(missing);

  return (
    <article className="sheet-view" aria-label="Ficha guardada">
      <h2>{sheet.name}</h2>
      <dl>
        <dt>Rendimiento</dt>
        <dd>
          <Amount {...sheet.yield} path="yield" missing={marked} />
        </dd>
        <dt>Raciones</dt>
        <dd>
          {marked.has("covers") ? (
            <Missing />
          ) : (
            <>
              {NUMBER.format(sheet.covers.value ?? 0)}
              {sheet.covers.estimated && ESTIMATED}
            </>
          )}
        </dd>
      </dl>

      <h3 id="sheet-view-ingredients">Ingredientes</h3>
      {sheet.ingredients.length === 0 ? (
        <p>Sin ingredientes</p>
      ) : (
        <ul aria-labelledby="sheet-view-ingredients">
          {sheet.ingredients.map((item, index) => (
            // Read-only and never reordered, so the position is a stable key.
            <li key={index}>
              {item.name}:{" "}
              <Amount {...item} path={`ingredients.${index}`} missing={marked} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default SheetView;
