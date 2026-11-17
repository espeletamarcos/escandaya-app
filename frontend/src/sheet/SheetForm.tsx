import { type ReactNode, type Ref, useEffect, useId, useReducer, useRef, useState } from "react";
import { formatDay } from "../preparations/format";
import EstimatedMark from "../ui/EstimatedMark";
import { PlusIcon } from "../ui/icons";
import "../ui/ScreenTitle.css";
import { Amount, Missing } from "./Amount";
import { NUMBER } from "./numbers";
import {
  canConfirm,
  type EditableUnit,
  editSheet,
  emptyFields,
  toEditable,
  toSheet,
} from "./sheetEditor";
import { type Sheet, UNITS } from "./types";
import "./Sheet.css";
import "./SheetForm.css";

interface TextFieldProps {
  label: string;
  /** The field's path, as in `emptyFields`: "yield.quantity", "ingredients.0.unit"… */
  name: string;
  value: string;
  missing: boolean;
  inputMode?: "decimal" | "numeric";
  onChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
}

function TextField({ label, name, value, missing, inputMode, onChange, ref }: TextFieldProps) {
  const id = useId();
  const markId = `${id}-missing`;
  return (
    <div className="sheet-field">
      <label htmlFor={id}>{label}</label>
      {/* Text, not type="number": Spanish iOS keyboards type a decimal comma. */}
      <input
        ref={ref}
        id={id}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        aria-invalid={missing || undefined}
        aria-describedby={missing ? markId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {/* The mark is linked to its field, so screen readers announce it too. */}
      {missing && <Missing id={markId} />}
    </div>
  );
}

interface UnitFieldProps {
  name: string;
  value: EditableUnit;
  missing: boolean;
  onChange: (value: EditableUnit) => void;
}

function UnitField({ name, value, missing, onChange }: UnitFieldProps) {
  const id = useId();
  const markId = `${id}-missing`;
  return (
    <div className="sheet-field">
      <label htmlFor={id}>Unidad</label>
      <select
        id={id}
        name={name}
        value={value}
        aria-invalid={missing || undefined}
        aria-describedby={missing ? markId : undefined}
        onChange={(event) => onChange(event.target.value as EditableUnit)}
      >
        <option value="">—</option>
        {UNITS.map((unit) => (
          <option key={unit} value={unit}>
            {unit}
          </option>
        ))}
      </select>
      {missing && <Missing id={markId} />}
    </div>
  );
}

function EstimatedField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="sheet-estimated">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Estimado
    </label>
  );
}

/** "Listo": closes the open line. */
function DoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="button-primary sheet-done" onClick={onClick}>
      Listo
    </button>
  );
}

/** Which line is open: the name, the yield, the covers or an ingredient (by id). */
type LineKey = "name" | "yield" | "covers" | number;

/** Where the focus goes after the next render. */
type FocusTarget = { field: true } | { line: LineKey } | { add: true };

export interface SheetFormProps {
  /** The sheet returned by the backend: the form's starting values. */
  sheet: Sheet;
  /** Called with the edited sheet when "Confirmar" is tapped. */
  onConfirm: (sheet: Sheet) => void;
  /** Saving, or saved: the button shows "Guardando…" and is disabled. */
  confirming: boolean;
  confirmError: string | null;
}

/**
 * The sheet returned by the backend, read like the saved one and edited line by
 * line (09-C8): each line is a button that opens its fields in place, one line at a
 * time, and "Listo" closes it. The edits live in the reducer, so closing a line, or
 * a failed confirm, keeps them; the "Falta" marks are recomputed on every change.
 */
function SheetForm({ sheet, onConfirm, confirming, confirmError }: SheetFormProps) {
  const [editable, dispatch] = useReducer(editSheet, sheet, toEditable);
  const [open, setOpen] = useState<LineKey | null>(null);
  const missing = new Set(emptyFields(editable));
  const allowed = canConfirm(editable);
  const values = toSheet(editable);
  const formId = useId();
  // The day the sheet was made, in red marker like the label on a container.
  const [createdAt] = useState(() => new Date().toISOString());

  const form = useRef<HTMLFormElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<FocusTarget | null>(null);

  // Focus moves after the render that shows (or removes) its target.
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if ("field" in target) firstField.current?.focus();
    else if ("line" in target) {
      form.current?.querySelector<HTMLButtonElement>(`[data-line="${target.line}"]`)?.focus();
    } else addButton.current?.focus();
  });

  const toggle = (key: LineKey) => {
    if (open === key) {
      setOpen(null);
    } else {
      setOpen(key);
      focusNext.current = { field: true };
    }
  };

  const close = () => {
    if (open === null) return;
    focusNext.current = { line: open };
    setOpen(null);
  };

  const add = () => {
    const id = editable.nextId;
    dispatch({ type: "add-ingredient" });
    setOpen(id);
    focusNext.current = { field: true };
  };

  const remove = (id: number) => {
    const index = editable.ingredients.findIndex((item) => item.id === id);
    const next = editable.ingredients[index + 1];
    dispatch({ type: "delete-ingredient", id });
    setOpen(null);
    focusNext.current = next ? { line: next.id } : { add: true };
  };

  const editorId = (key: LineKey) => `${formId}-line-${key}`;

  /** What every line button says: what it opens, and whether it is open. */
  const lineState = (key: LineKey) => ({
    "data-line": key,
    "aria-expanded": open === key,
    "aria-controls": open === key ? editorId(key) : undefined,
  });

  const covers = values.covers.value;
  const coversText = covers === 1 ? "1 ración" : `${NUMBER.format(covers ?? 0)} raciones`;

  return (
    // Only the button confirms: the keyboard's "Ir" key would submit the form while
    // the chef is still typing a quantity.
    <form
      ref={form}
      className="sheet-form"
      aria-label="Ficha"
      onSubmit={(event) => event.preventDefault()}
    >
      <header className="sheet-header">
        <h1 className="screen-title sheet-title">
          <button
            type="button"
            {...lineState("name")}
            onClick={() => toggle("name")}
            className="screen-title-tape sheet-title-button"
          >
            <span className="visually-hidden">Editar nombre:</span>{" "}
            {missing.has("name") ? (
              <>
                <span className="sheet-unnamed">Sin nombre</span> <Missing />
              </>
            ) : (
              values.name
            )}
          </button>
        </h1>
        {open === "name" && (
          <Editor id={editorId("name")} onDone={close}>
            <TextField
              ref={firstField}
              label="Nombre"
              name="name"
              value={editable.name}
              missing={missing.has("name")}
              onChange={(value) => dispatch({ type: "name", value })}
            />
          </Editor>
        )}

        <div className="sheet-meta">
          <p className="sheet-meta-values">
            <button
              type="button"
              {...lineState("yield")}
              onClick={() => toggle("yield")}
              className="sheet-meta-button"
            >
              <span className="visually-hidden">Editar rendimiento:</span>{" "}
              {missing.has("yield.quantity") && missing.has("yield.unit") ? (
                <>
                  Rendimiento <Missing />
                </>
              ) : (
                <Amount {...values.yield} path="yield" missing={missing} />
              )}
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              {...lineState("covers")}
              onClick={() => toggle("covers")}
              className="sheet-meta-button"
            >
              <span className="visually-hidden">Editar raciones:</span>{" "}
              {missing.has("covers") ? (
                <>
                  Raciones <Missing />
                </>
              ) : values.covers.estimated ? (
                <EstimatedMark>{coversText}</EstimatedMark>
              ) : (
                coversText
              )}
            </button>
            {/* The dot travels with "sin confirmar", so a wrapped line never ends in one. */}
            <span className="sheet-unconfirmed">
              <span aria-hidden="true">· </span>sin confirmar
            </span>
          </p>
          <time className="sheet-date" dateTime={createdAt}>
            {formatDay(createdAt)}
          </time>
        </div>
        {open === "yield" && (
          <Editor id={editorId("yield")} legend="Rendimiento" onDone={close}>
            <div className="sheet-amount-fields">
              <TextField
                ref={firstField}
                label="Cantidad"
                name="yield.quantity"
                inputMode="decimal"
                value={editable.yield.quantity}
                missing={missing.has("yield.quantity")}
                onChange={(quantity) => dispatch({ type: "yield", changes: { quantity } })}
              />
              <UnitField
                name="yield.unit"
                value={editable.yield.unit}
                missing={missing.has("yield.unit")}
                onChange={(unit) => dispatch({ type: "yield", changes: { unit } })}
              />
            </div>
            <EstimatedField
              checked={editable.yield.estimated}
              onChange={(estimated) => dispatch({ type: "yield", changes: { estimated } })}
            />
          </Editor>
        )}
        {open === "covers" && (
          <Editor id={editorId("covers")} legend="Raciones" onDone={close}>
            <TextField
              ref={firstField}
              label="Cantidad"
              name="covers"
              inputMode="numeric"
              value={editable.covers.value}
              missing={missing.has("covers")}
              onChange={(value) => dispatch({ type: "covers", changes: { value } })}
            />
            <EstimatedField
              checked={editable.covers.estimated}
              onChange={(estimated) => dispatch({ type: "covers", changes: { estimated } })}
            />
          </Editor>
        )}
      </header>

      <section className="sheet-ingredients panel" aria-labelledby={`${formId}-ingredients`}>
        <div className="sheet-columns">
          <h2 id={`${formId}-ingredients`}>Ingredientes</h2>
          <span aria-hidden="true">Cantidad</span>
        </div>
        <ul className="sheet-lines">
          {editable.ingredients.map((item, index) => {
            const path = `ingredients.${index}`;
            const isOpen = open === item.id;
            return (
              // Keyed by id, not position, so deleting a line keeps the others' elements.
              <li key={item.id} className={isOpen ? "sheet-line open" : "sheet-line"}>
                <button
                  type="button"
                  {...lineState(item.id)}
                  onClick={() => toggle(item.id)}
                  className="sheet-line-button sheet-row"
                >
                  <span className="sheet-line-name">
                    <span className="visually-hidden">Editar</span>{" "}
                    {missing.has(`${path}.name`) ? (
                      <>
                        <span className="sheet-unnamed">Sin nombre</span> <Missing />
                      </>
                    ) : (
                      values.ingredients[index].name
                    )}
                  </span>{" "}
                  <span className="sheet-line-amount">
                    <Amount {...values.ingredients[index]} path={path} missing={missing} />
                  </span>
                </button>
                {isOpen && (
                  <Editor
                    id={editorId(item.id)}
                    legend={`Ingrediente ${index + 1}`}
                    onDone={close}
                    onDelete={() => remove(item.id)}
                  >
                    <TextField
                      ref={firstField}
                      label="Nombre"
                      name={`${path}.name`}
                      value={item.name}
                      missing={missing.has(`${path}.name`)}
                      onChange={(name) =>
                        dispatch({
                          type: "ingredient",
                          id: item.id,
                          changes: { name },
                        })
                      }
                    />
                    <div className="sheet-amount-fields">
                      <TextField
                        label="Cantidad"
                        name={`${path}.quantity`}
                        inputMode="decimal"
                        value={item.quantity}
                        missing={missing.has(`${path}.quantity`)}
                        onChange={(quantity) =>
                          dispatch({
                            type: "ingredient",
                            id: item.id,
                            changes: { quantity },
                          })
                        }
                      />
                      <UnitField
                        name={`${path}.unit`}
                        value={item.unit}
                        missing={missing.has(`${path}.unit`)}
                        onChange={(unit) =>
                          dispatch({
                            type: "ingredient",
                            id: item.id,
                            changes: { unit },
                          })
                        }
                      />
                    </div>
                    <EstimatedField
                      checked={item.estimated}
                      onChange={(estimated) =>
                        dispatch({
                          type: "ingredient",
                          id: item.id,
                          changes: { estimated },
                        })
                      }
                    />
                  </Editor>
                )}
              </li>
            );
          })}
        </ul>
        <button ref={addButton} type="button" className="sheet-add" onClick={add}>
          <PlusIcon />
          Añadir ingrediente
        </button>
      </section>

      <p className="sheet-legend">
        <span className="estimated">≈ en azul</span>: estimado. Toca una línea para corregirla.
      </p>

      {!allowed && (
        <p className="sheet-hint">
          Escribe el nombre de la preparación y de cada ingrediente para confirmar.
        </p>
      )}
      {confirmError && (
        <p role="alert" className="message-error sheet-error">
          {confirmError}
        </p>
      )}
      <button
        type="button"
        className="button-primary sheet-confirm"
        disabled={confirming || !allowed}
        onClick={() => onConfirm(toSheet(editable))}
      >
        {confirming ? "Guardando…" : "Confirmar ficha"}
      </button>
    </form>
  );
}

interface EditorProps {
  id: string;
  /** Names the group of fields; the name line has a single field and needs none. */
  legend?: string;
  onDone: () => void;
  onDelete?: () => void;
  children: ReactNode;
}

/** The fields of the open line, with "Eliminar" (ingredients only) and "Listo". */
function Editor({ id, legend, onDone, onDelete, children }: EditorProps) {
  const actions = (
    <div className="sheet-editor-actions">
      {onDelete && (
        <button type="button" className="sheet-delete" onClick={onDelete}>
          Eliminar
        </button>
      )}
      <DoneButton onClick={onDone} />
    </div>
  );
  if (!legend) {
    return (
      <div id={id} className="sheet-editor">
        {children}
        {actions}
      </div>
    );
  }
  return (
    <fieldset id={id} className="sheet-editor">
      <legend className="visually-hidden">{legend}</legend>
      {children}
      {actions}
    </fieldset>
  );
}

export default SheetForm;
