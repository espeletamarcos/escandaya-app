import { useId, useReducer } from "react";
import { type EditableUnit, editSheet, emptyFields, toEditable } from "./sheetEditor";
import { type Sheet, UNITS } from "./types";
import "./SheetForm.css";

interface TextFieldProps {
  label: string;
  /** The field's path, as in `emptyFields`: "yield.quantity", "ingredients.0.unit"… */
  name: string;
  value: string;
  missing: boolean;
  inputMode?: "decimal" | "numeric";
  onChange: (value: string) => void;
}

/** The "Falta" mark, linked to its field so screen readers announce it too. */
function MissingMark({ id }: { id: string }) {
  return (
    <span id={id} className="missing-mark">
      Falta
    </span>
  );
}

function TextField({ label, name, value, missing, inputMode, onChange }: TextFieldProps) {
  const id = useId();
  const markId = `${id}-missing`;
  return (
    <div className="sheet-field">
      <label htmlFor={id}>{label}</label>
      {/* Text, not type="number": Spanish iOS keyboards type a decimal comma. */}
      <input
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
      {missing && <MissingMark id={markId} />}
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
      {missing && <MissingMark id={markId} />}
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
    <label className="sheet-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      Estimado
    </label>
  );
}

/**
 * The sheet returned by the backend, as an editable form. Edits stay on the phone;
 * the "Falta" marks are recomputed from the edited values on every change.
 */
function SheetForm({ sheet }: { sheet: Sheet }) {
  const [editable, dispatch] = useReducer(editSheet, sheet, toEditable);
  const missing = new Set(emptyFields(editable));

  return (
    <form className="sheet-form" aria-label="Ficha" onSubmit={(event) => event.preventDefault()}>
      <TextField
        label="Nombre"
        name="name"
        value={editable.name}
        missing={missing.has("name")}
        onChange={(value) => dispatch({ type: "name", value })}
      />

      <fieldset>
        <legend>Rendimiento</legend>
        <TextField
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
        <EstimatedField
          checked={editable.yield.estimated}
          onChange={(estimated) => dispatch({ type: "yield", changes: { estimated } })}
        />
      </fieldset>

      <fieldset>
        <legend>Raciones</legend>
        <TextField
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
      </fieldset>

      <fieldset>
        <legend>Ingredientes</legend>
        {editable.ingredients.map((item, index) => {
          const path = `ingredients.${index}`;
          return (
            // Keyed by id, not position, so deleting a row keeps the others' elements.
            <fieldset key={item.id} className="sheet-ingredient">
              <legend>Ingrediente {index + 1}</legend>
              <TextField
                label="Nombre"
                name={`${path}.name`}
                value={item.name}
                missing={missing.has(`${path}.name`)}
                onChange={(name) => dispatch({ type: "ingredient", id: item.id, changes: { name } })}
              />
              <TextField
                label="Cantidad"
                name={`${path}.quantity`}
                inputMode="decimal"
                value={item.quantity}
                missing={missing.has(`${path}.quantity`)}
                onChange={(quantity) =>
                  dispatch({ type: "ingredient", id: item.id, changes: { quantity } })
                }
              />
              <UnitField
                name={`${path}.unit`}
                value={item.unit}
                missing={missing.has(`${path}.unit`)}
                onChange={(unit) => dispatch({ type: "ingredient", id: item.id, changes: { unit } })}
              />
              <EstimatedField
                checked={item.estimated}
                onChange={(estimated) =>
                  dispatch({ type: "ingredient", id: item.id, changes: { estimated } })
                }
              />
              <button
                type="button"
                onClick={() => dispatch({ type: "delete-ingredient", id: item.id })}
              >
                Eliminar
              </button>
            </fieldset>
          );
        })}
        <button type="button" onClick={() => dispatch({ type: "add-ingredient" })}>
          Añadir ingrediente
        </button>
      </fieldset>
    </form>
  );
}

export default SheetForm;
