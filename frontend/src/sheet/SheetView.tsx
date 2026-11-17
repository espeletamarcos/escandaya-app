import { useId } from "react";
import { formatDate, formatDay } from "../preparations/format";
import EstimatedMark from "../ui/EstimatedMark";
import ScreenTitle from "../ui/ScreenTitle";
import { Amount, Missing } from "./Amount";
import { NUMBER } from "./numbers";
import type { Sheet } from "./types";
import "./Sheet.css";

interface SheetViewProps {
  sheet: Sheet;
  /** The backend's missing data paths ("covers", "ingredients.1.unit"…): the marks. */
  missing: string[];
  /** When the sheet was confirmed: the red date and "Confirmada el …". */
  confirmedAt?: string;
}

/**
 * A saved sheet, read-only (Screen 6): laid out like the draft sheet, but its lines
 * are not buttons. The marks come from the backend, never from the phone.
 */
function SheetView({ sheet, missing, confirmedAt }: SheetViewProps) {
  const marked = new Set(missing);
  const ingredientsId = useId();
  const covers = sheet.covers.value;
  const coversText = covers === 1 ? "1 ración" : `${NUMBER.format(covers ?? 0)} raciones`;

  return (
    <article className="sheet-view" aria-label="Ficha guardada">
      <header className="sheet-header">
        <ScreenTitle>{sheet.name}</ScreenTitle>
        <div className="sheet-meta">
          {/* The labels are for screen readers: on screen the values speak for themselves. */}
          <dl className="sheet-meta-values">
            <div>
              <dt className="visually-hidden">Rendimiento</dt>
              <dd>
                {marked.has("yield.quantity") && marked.has("yield.unit") ? (
                  <>
                    <span aria-hidden="true">Rendimiento</span> <Missing />
                  </>
                ) : (
                  <Amount {...sheet.yield} path="yield" missing={marked} />
                )}
              </dd>
            </div>
            <div>
              <dt className="visually-hidden">Raciones</dt>
              <dd>
                {marked.has("covers") ? (
                  <>
                    <span aria-hidden="true">Raciones</span> <Missing />
                  </>
                ) : sheet.covers.estimated ? (
                  <EstimatedMark>{coversText}</EstimatedMark>
                ) : (
                  coversText
                )}
              </dd>
            </div>
          </dl>
          {confirmedAt && (
            <time className="sheet-date" dateTime={confirmedAt}>
              {formatDay(confirmedAt)}
            </time>
          )}
        </div>
        {confirmedAt && <p className="sheet-confirmed">Confirmada el {formatDate(confirmedAt)}</p>}
      </header>

      <section className="sheet-ingredients panel" aria-labelledby={ingredientsId}>
        <div className="sheet-columns">
          <h2 id={ingredientsId}>Ingredientes</h2>
          <span aria-hidden="true">Cantidad</span>
        </div>
        {sheet.ingredients.length === 0 ? (
          <p className="sheet-empty">Sin ingredientes</p>
        ) : (
          <ul className="sheet-lines" aria-labelledby={ingredientsId}>
            {sheet.ingredients.map((item, index) => (
              // Read-only and never reordered, so the position is a stable key.
              <li key={index} className="sheet-line sheet-row">
                <span className="sheet-line-name">{item.name}</span>{" "}
                <span className="sheet-line-amount">
                  <Amount {...item} path={`ingredients.${index}`} missing={marked} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="sheet-legend">
        <span className="estimated">≈ en azul</span>: estimado.
      </p>
    </article>
  );
}

export default SheetView;
