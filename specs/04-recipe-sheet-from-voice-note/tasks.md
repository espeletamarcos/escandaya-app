# 04 – Tasks

## Backend
- [x] Write tests, then add `STRUCTURING_MODEL` to `settings.py` (default `gpt-5-mini`) and to `conftest.make_settings` (04-C2)
- [x] Write tests, then add `sheets.py` with the `Unit`, `Ingredient`, `Yield`, `Covers` and `Sheet` models:
  - Names trimmed, 1–120 chars; quantities `> 0` and `<= 100000`; covers 1–10000; 0–100 ingredients.
  - `yield_` with the JSON alias `yield`, and `extra="forbid"` on every model.

  (04-C3)
- [x] Write a table test, then add `missing_fields(sheet)`, returning `yield.quantity`, `yield.unit`, `covers`, `ingredients.<i>.quantity` and `ingredients.<i>.unit` (04-C4)
- [x] Define the `Structurer` protocol, `StructuringResult` (`raw`, `input_tokens`, `output_tokens`), `StructuringError` and `StructuringTimeout` in `structuring.py`. Add a `FakeStructurer` to `conftest.py` that returns a fixed raw string or raises and records its calls, and wire the structurer into the app as an overridable dependency (04-C2)
- [x] Write tests, then add `POST /api/drafts` on the protected router:
  - Body `{"text": ...}`, trimmed, 1–5,000 chars, otherwise 422.
  - Run the structurer in the thread pool with the text, validate `raw` against the output wrapper and return `{is_preparation, sheet, missing}`.
  - `is_preparation: false` returns `sheet: null` and `missing: []`.
  - 503 without `OPENAI_API_KEY`.

  (04-C2, 04-C4, 04-C7)
- [x] Write tests, then map failures to responses with a generic `detail` (no key, no provider message, no model output):
  - 502 for a provider error, invalid JSON, an unknown unit, a negative quantity, missing fields, and `is_preparation: true` with a null sheet.
  - 504 for a timeout.

  (04-C3, 04-C7)
- [x] Write tests with `caplog`, then add the log line `structuring status=%d chars=%s duration_ms=%s input_tokens=%s output_tokens=%s`. An invalid output logs `status=502` with its tokens. Assert that the text, the raw output and the ingredient names never appear in the logs, including on validation errors (04-C8)
- [x] Write a unit test, then add `strict_schema()`: generate the schema of `{"is_preparation": bool, "sheet": Sheet | null}`, set `additionalProperties: false`, mark every property required, and keep only the keywords strict mode accepts (04-C3)
- [x] Implement `OpenAIStructurer`:
  - Responses API with a strict `json_schema` text format from `strict_schema()`, and the system prompt as a module constant (units, conversions, `estimated` for approximate words and ranges, unknown units left empty, nothing invented, `is_preparation: false` for small talk).
  - The configured model, a 45s timeout, SDK retries off, `max_output_tokens` high enough for 100 ingredients, no `temperature`.
  - A refusal, an `incomplete` response or missing output text raises `StructuringError`.
  - One client per key and model with `lru_cache`.

  (04-C2, 04-C3)

## Frontend
- [x] Add `sheet/types.ts` (`Unit`, `Ingredient`, `Sheet`, `Draft`). Write tests, then add `createDraft(text)` to `client.ts`: token header, 60s timeout, a check of the response shape (top-level fields, ingredient fields, units in the list) and `ApiError("failed")` for anything else, 422 included (04-C1, 04-C3, 04-C7)
- [x] Write tests, then add `useVoiceSheet`, replacing `useTranscription` and moving its tests:
  - Steps `idle | transcribing | structuring | done | no-voice | not-preparation | error`, with both client functions injected.
  - Transcribe only when there is no transcript yet. Empty text stops at `no-voice` without calling `createDraft`.
  - A retry after a structuring error calls only `createDraft` with the stored transcript.
  - Request ids, the pending guard, and `reset()` clearing the transcript and dropping late results, as in spec 03.
  - Spanish error messages per error kind and step.

  (04-C1, 04-C7, edge cases)
- [x] Write tests, then add `sheetEditor.ts`: `toEditable` (numbers as strings, a client id per ingredient), the edit reducer (name, yield, covers, each ingredient's fields, add, delete), `parseQuantity` (comma or dot, `> 0`, else null) and `emptyFields` (04-C5, 04-C6)
- [x] Write tests, then add `SheetForm`:
  - Labelled inputs "Nombre", "Rendimiento", "Raciones" and one row per ingredient.
  - Quantities with `inputMode="decimal"` (covers `numeric`), units as a `<select>` with an empty option and the five units, "Estimado" as a checkbox.
  - "Eliminar" per row with no confirmation, and "Añadir ingrediente".
  - "Falta" on fields marked as missing, appearing and disappearing as the chef edits.

  (04-C5, 04-C6)
- [x] Write tests, then update `RecordScreen`:
  - The button "Transcribir y crear ficha", with "Transcribiendo…" and "Creando ficha…" while waiting.
  - Disabled while pending and after `done`, `no-voice` or `not-preparation` until a new recording; enabled after `error`.
  - On `done`, render `SheetForm` keyed by the request id. Never render the transcript.
  - "No parece una preparación" and "No se ha detectado voz".
  - The first render marks exactly the fields in the fake response's `missing`.
  - Remove `useTranscription` and its tests, now covered by `useVoiceSheet`.

  (04-C1, 04-C5, 04-C7, edge cases)

## Operations
- [ ] Extend `scripts/smoke.sh` to check that `POST /api/drafts` without a token returns 401 (04-C2)
- [ ] Write `scripts/structure_trial.py`: run every `.txt` transcript in a given folder through `OpenAIStructurer` for each candidate model (`gpt-5-nano`, `gpt-5-mini`, `gpt-4.1-mini` by default), validate with the endpoint's code, and print the sheet and its missing data or the validation failure, the time, the tokens and the text length (04-C8)
- [ ] Update `README.MD`:
  - `STRUCTURING_MODEL` in the secrets table.
  - The one OpenAI key and its $5/month cap cover transcription and structuring.
  - Remove the Anthropic key and cap.
  - The new trial script, with its separate, temporary key.

  (04-C8)

## Manual checks
- [ ] Produce transcripts of real kitchen recordings with `transcribe_trial.py`, run the structuring trial, choose the model, set `STRUCTURING_MODEL` on Fly and record the choice in `docs/product/stack.md` (the Structuring row and the open decision). Confirm the 5,000-char cap against the real lengths. Note results here (04-C8)
- [ ] On the deployed app, on the iPhone: dictate a real preparation, check that the sheet is recognisable, fix it by editing (decimal comma included), and check a structuring error with retry. Note results here (04-C1, 04-C5, 04-C6, 04-C7, 04-C8)
- [ ] Check `fly logs` after creating a sheet: one `structuring` line, and no transcript text or sheet content (04-C8)
- [ ] Update the status of spec 04 in `specs/README.md` as it moves to `in progress` and `implemented`
