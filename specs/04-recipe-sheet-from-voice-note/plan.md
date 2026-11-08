# 04 – Plan

## Approach

### Backend
1. **Settings.** `settings.py` gets `STRUCTURING_MODEL`. It defaults to `gpt-5-mini` until the trial (04-C8) picks a model. `OPENAI_API_KEY` is the same key as transcription. `conftest.make_settings` gets the new field.
2. **Sheet models (`sheets.py`).** These are the Pydantic models of the sheet, kept apart from the OpenAI code so spec 05 can reuse them to validate a confirmed sheet:
   - `Unit`: `Literal["g", "kg", "ml", "l", "ud"]`.
   - `Ingredient`: `name` (1–120 chars after trimming), `quantity` (`float | None`, `> 0`, `<= 100000`), `unit` (`Unit | None`), `estimated: bool`.
   - `Yield`: `quantity`, `unit` and `estimated`, with the same rules as an ingredient.
   - `Covers`: `value` (`int | None`, 1–10000), `estimated: bool`.
   - `Sheet`: `name` (1–120 chars), `yield_` (JSON alias `yield`), `covers`, `ingredients` (0–100 items).
   - All models use `extra="forbid"`.

   Yield and covers get an `estimated` flag too: the edge cases need it ("30 o 40 raciones" gives the lower value, marked as estimated), and "unos 2 kilos" is the same case for the yield.
3. **Missing data (`sheets.missing_fields(sheet) -> list[str]`).** A pure function that returns paths:
   - `"yield.quantity"` and `"yield.unit"`.
   - `"covers"`.
   - `"ingredients.<i>.quantity"` and `"ingredients.<i>.unit"`.

   It is tested with a table of cases (04-C4). Spec 05 calls the same function on confirm.
4. **`Structurer` interface (`structuring.py`).** A `Protocol` with `structure(text: str) -> StructuringResult`. `StructuringResult` holds `raw: str` (the model's JSON text, not yet validated), `input_tokens` and `output_tokens`.
   - The structurer does **not** validate. The endpoint does. This keeps one validation path, lets a fake return bad JSON for 04-C3, and still logs tokens when the output is invalid (they were paid for).
   - `StructuringError` and `StructuringTimeout` mirror the transcription errors.
   - `FakeStructurer` in `conftest.py` returns a fixed raw string or raises, and records its calls.
5. **`OpenAIStructurer`.**
   - Uses the Responses API with `text.format = {"type": "json_schema", "strict": true}`.
   - The schema is generated from a model-output wrapper `{"is_preparation": bool, "sheet": Sheet | null}` by a small helper, `strict_schema()`. The helper sets `additionalProperties: false`, marks every property as required, and keeps only the keywords strict mode accepts (types, enums, nullability, `$defs`). Pydantic still enforces the numeric and length limits on our side.
   - The system prompt (a constant in the module) says:
     - Use only these units. Convert "2 kilos" to 2 kg, "medio litro" to 0.5 l, and "una docena" to 12 ud.
     - Approximate words ("unos", "más o menos") set `estimated`.
     - A range gives the lower value, marked as estimated.
     - A unit outside the list ("un puñado", "una pizca") leaves the quantity and unit null and keeps the name as dictated.
     - Never invent ingredients or quantities.
     - Small talk or noise gives `is_preparation: false`.
   - Other settings:
     - 45s timeout and SDK retries off, as in spec 03.
     - `max_output_tokens` high enough for 100 ingredients.
     - No `temperature`, because reasoning models reject it.
   - A refusal, an `incomplete` response, or missing output text raises `StructuringError`.
   - One client per key and model (`lru_cache`), as in spec 03.
6. **`POST /api/drafts`.** Protected. The body is `{"text": "..."}`, and the text is trimmed, with 1–5,000 chars. Otherwise it returns 422.
   - Why 5,000: a 2-minute note at a fast 200 words/min is about 400 words, roughly 2,400 chars, so the cap leaves about 2x margin. The trial prints real lengths to confirm it.
   - Responses:
     - `200 {"is_preparation": true, "sheet": {...}, "missing": [...]}`.
     - `200 {"is_preparation": false, "sheet": null, "missing": []}`.
     - `422` for empty text or text over the cap.
     - `502` on a provider error, on invalid JSON, on output that fails `Sheet` validation, or on `is_preparation: true` with a null sheet. The `detail` is generic: no key, no provider message, no model output (04-C3, 04-C7).
     - `504` on timeout.
     - `503` without `OPENAI_API_KEY`.
   - The structurer runs in the thread pool, like the transcriber.
7. **Logs (04-C8).** One line per call:

   `structuring status=%d chars=%s duration_ms=%s input_tokens=%s output_tokens=%s`

   An invalid output logs `status=502` with its tokens. The text, the raw output and the sheet are never logged, including in validation errors, which are caught and dropped. Tests use `caplog` and assert that neither the fake transcript nor the ingredient names appear in the logs.

### Frontend
1. **Types (`frontend/src/sheet/types.ts`).** `Unit`, `Ingredient`, `Sheet` and `Draft`, matching the response.
2. **`client.ts`.** A new function, `createDraft(text): Promise<Draft>`.
   - Timeout of 60s. The backend gives up at 45s, and the machine is already warm after the transcription.
   - It checks the response shape it relies on (top-level fields, the ingredient fields, units in the list). Anything else becomes `ApiError("failed")`.
   - A 422 maps to `failed`, like other server errors.
3. **`useVoiceSheet` hook (`frontend/src/sheet/useVoiceSheet.ts`).** It replaces `useTranscription`. The spec 03 tests are moved to it and extended. Both client functions are injected, so tests pass fakes.
   - `step`: `idle | transcribing | structuring | done | no-voice | not-preparation | error`.
   - The transcript is kept in a ref, and is also exposed for spec 05.
   - `run(audio)`: if there is no transcript yet, it transcribes. If the text is empty, it stops at `no-voice` (structuring is not called). Otherwise it calls `createDraft`.
   - A retry after a structuring error reuses the stored transcript, so the audio is not sent again (04-C7).
   - Request ids and the pending guard work as in spec 03. A second tap while pending is ignored. `reset()` on a new recording clears the transcript and drops late results.
   - Error messages are in Spanish, one per error kind and step ("No se ha podido crear la ficha…" vs "No se ha podido transcribir…").
4. **Sheet editing (`frontend/src/sheet/sheetEditor.ts`).** These are pure functions, tested without React.
   - `toEditable(sheet)`: numbers become strings, so "0," survives while typing, and each ingredient gets a client id for stable React keys.
   - A reducer handles every edit: name, yield, covers, and each ingredient's fields; add an ingredient; delete one.
   - `parseQuantity` accepts a comma or a dot (Spanish iOS keyboards type a comma). It returns a number `> 0`, or null.
   - `emptyFields(editable)` gives display marks only: name, yield quantity and unit, covers, and each ingredient's name, quantity and unit. A field is marked when it is empty or does not parse.
5. **`SheetForm` (`frontend/src/sheet/SheetForm.tsx`).** It renders the editable sheet with labelled inputs:
   - Fields: "Nombre", "Rendimiento", "Raciones", and one row per ingredient.
   - Quantity inputs are `inputMode="decimal"` (covers use `numeric`). Units are a `<select>` with an empty option and the five units. "Estimado" is a checkbox.
   - Each row has an "Eliminar" button that deletes it with no confirmation. "Añadir ingrediente" adds an empty row.
   - Fields marked as missing show "Falta". Estimated values are shown through their checked toggle.
   - No visual polish: styling waits for its own spec.
6. **`RecordScreen`.**
   - The button becomes "Transcribir y crear ficha". It shows "Transcribiendo…" and then "Creando ficha…" while it waits.
   - The button is disabled while pending and after `done`, `no-voice` or `not-preparation`, until a new recording. It is enabled again after `error`.
   - On `done` it renders `SheetForm`, keyed by the request id so a new draft starts clean. The transcript is never rendered (04-C5).
   - On `not-preparation` it shows "No parece una preparación", and on `no-voice` it shows "No se ha detectado voz".

### Model trial and operations
- `scripts/structure_trial.py` uses the same layout as `transcribe_trial.py`. It takes a folder of `.txt` transcripts, outside the repo, and runs each one through `OpenAIStructurer` for each candidate model. It validates the output with the same code as the endpoint and prints:
  - the sheet and its missing data, or the validation failure;
  - the time;
  - the input and output tokens;
  - the text length.

  The default candidates are `gpt-5-nano`, `gpt-5-mini` and `gpt-4.1-mini`, to be checked against the model list when the trial runs. The transcripts come from running `transcribe_trial.py` on real recordings.
- You choose the model by reading the sheets. The choice goes to `docs/product/stack.md` (the Structuring row and the open decision) and to the `STRUCTURING_MODEL` Fly secret.
- README:
  - Add `STRUCTURING_MODEL` to the secrets table.
  - Say that the one OpenAI key covers transcription and structuring under the $5/month cap.
  - Remove the Anthropic cap.
  - Mention the new trial script, which also uses a separate, temporary key.
- `scripts/smoke.sh` checks that `POST /api/drafts` without a token returns 401.

Mapping to criteria:
- 04-C1: `useVoiceSheet` and `RecordScreen` tests with fake client functions (call order, both labels, button disabled while pending and after success).
- 04-C2: pytest with `FakeStructurer` (text and model passed, 503 without a key); `test_settings.py` for `STRUCTURING_MODEL`.
- 04-C3: pytest where the fake returns bad JSON, an unknown unit, a negative quantity, missing fields, or `is_preparation: true` with no sheet. Each case gets a 502 with a generic detail. A `strict_schema()` unit test checks the generated schema.
- 04-C4: table test of `missing_fields`.
- 04-C5, 04-C6: `sheetEditor` unit tests and `SheetForm` / `RecordScreen` tests.
- 04-C7: pytest for 502, 504 and 422. Hook tests check that a retry after a structuring error calls only `createDraft`, and after a network error the audio is kept.
- 04-C8: pytest with `caplog`. The phone check, the trial and the README are manual checks, recorded in `tasks.md`.

## Alternatives considered
- **`responses.parse(text_format=Model)`:** the SDK builds the schema and validates. But validation errors are raised inside the SDK, so the fake and the real path would validate differently, and the tokens of an invalid answer are harder to log. Discarded.
- **A hand-written JSON schema next to the Pydantic models:** simple, but two sources of truth for the units and fields. Discarded in favour of generating it.
- **Chat Completions instead of the Responses API:** both support strict JSON schema. Responses is the API OpenAI recommends now. Discarded.
- **One endpoint from audio to sheet:** one round trip, but a structuring retry would upload and pay for the audio again (04-C7). Discarded.
- **Marking missing data while editing with the backend's list:** each edit would need a round trip. The spec makes the frontend marks display-only and the backend recomputes them on confirm. Discarded.
- **`<input type="number">` for quantities:** on Spanish iOS the decimal comma is often rejected or cleared. `inputMode="decimal"` with our own parsing avoids that. Discarded.
- **Keeping `useTranscription` and adding a second hook:** two hooks would have to coordinate request ids and resets for one button. Discarded.

## Files touched
- `backend/src/backend/settings.py`: `STRUCTURING_MODEL`.
- `backend/src/backend/sheets.py` (new): sheet models, `missing_fields`.
- `backend/src/backend/structuring.py` (new): `Structurer`, `OpenAIStructurer`, `strict_schema`, prompt, endpoint, log line.
- `backend/src/backend/main.py`: mount the structuring router on the protected router.
- `backend/tests/conftest.py`: `FakeStructurer`, client factory option, settings field.
- `backend/tests/`: `test_sheets.py`, `test_structuring.py` (new); `test_settings.py`.
- `frontend/src/api/client.ts` and `client.test.ts`: `createDraft`, response check.
- `frontend/src/sheet/` (new): `types.ts`, `useVoiceSheet.ts`, `sheetEditor.ts`, `SheetForm.tsx`, and their tests.
- `frontend/src/transcription/useTranscription.ts` and its test: removed, with the tests moved to `useVoiceSheet`.
- `frontend/src/screens/RecordScreen.tsx` and tests.
- `scripts/structure_trial.py` (new), `scripts/smoke.sh`.
- `README.MD`, `docs/product/stack.md`.
- `specs/README.md`, `spec.md`: status.

No new dependency: `openai` and `pydantic` are already installed.

## Risks
- **Model parameters differ between candidates.** Reasoning models reject `temperature` and spend reasoning tokens from `max_output_tokens`. The trial shows this before the model is chosen. If one model needs a special parameter, it goes in `OpenAIStructurer`, not in the endpoint.
- **Strict-mode schema limits.** If the API rejects a keyword the helper kept, the trial fails at once. The fix stays inside `strict_schema()`, and Pydantic remains the check.
- **Quality of unit handling** ("medio kilo", "litro y medio", "dos docenas", "una lata"). This is checked in the trial and on the phone. Wrong conversions can be fixed by hand, and spec 05 recomputes the missing data.
- **Two sources of "missing" rules.** The frontend display marks can drift from `missing_fields`. They are display-only, and the backend list is used on confirm. A `RecordScreen` test checks that the first render marks exactly the fields in the fake response's `missing`.
- **Latency.** Two sequential calls after a cold start may take a while. Each step has its own message and timeout, so the chef sees progress, and a retry repeats only the failed step.
- **Cost.** Each recording now makes two calls, and a structuring retry pays again for structuring only. Structuring a 2,400-char text is a small fraction of the transcription cost. The $5 cap and the one-run-per-recording rule bound it until spec 08.
- **Edits are lost if iOS closes the app in the background.** This is accepted by the spec.
- **Shape of `Sheet` is shared with spec 05.** Changing it after spec 05 needs a migration, so it is worth reviewing the fields now.
