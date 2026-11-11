# 04 – Recipe sheet from a voice note

Status: in progress

## Why
The chef can dictate a preparation and read it back as text (spec 03), but text is not a recipe sheet. This spec turns the voice note into an editable sheet in one step: the transcript goes to an OpenAI model, our code validates the JSON it returns, and the chef sees the sheet with what is missing and can fix it by hand. We learn whether the sheets are good enough before storing anything (spec 05).

## Scope
- The "Transcribir" button from spec 03 becomes "Transcribir y crear ficha". One tap:
  - Transcribes the audio with the existing endpoint.
  - Sends the text to a new structuring endpoint.
  - Shows the sheet.

  Both calls go through `frontend/src/api/client.ts`. While waiting, the app shows two steps: "Transcribiendo…", then "Creando ficha…".
- The sheet replaces the transcript from spec 03 on screen: the chef sees the sheet, not the text. The transcript is kept in memory only, to retry the structuring and to send it on confirm (spec 05).
- A backend endpoint that receives the text, calls an OpenAI model with structured output (JSON schema), validates the result with Pydantic, computes the missing data, and returns the sheet.
- The model call behind a `Structurer` interface, with an OpenAI implementation and a fake for tests (the same pattern as `Transcriber`).
- The sheet:
  - Preparation name.
  - Yield (quantity + unit).
  - Covers.
  - Ingredients, each with name, quantity, unit and an estimated flag.

  Units come from a fixed list: `g`, `kg`, `ml`, `l`, `ud`.
- Missing data is computed in code, not by the model: missing yield, missing covers, and ingredients without a quantity or unit.
- The sheet is editable:
  - Every value can be changed.
  - Quantities use the number keyboard, units are chosen from the fixed list, and the estimated flag is a toggle.
  - An ingredient can be added, or deleted with a single tap.
  - While editing, empty required fields are marked as missing on screen. This is only display: the backend stays the authority on missing data and recomputes it when the sheet is confirmed (spec 05).
- OpenAI is the only provider: structuring uses the same `OPENAI_API_KEY` as transcription, so there is one key and one bill. The model comes from a backend environment variable (`STRUCTURING_MODEL`). The model is chosen by running `scripts/structure_trial.py` on real transcripts, and the choice is recorded in `docs/product/stack.md`.
- The OpenAI $5/month spending cap from spec 03 now covers both transcription and structuring. The README is updated to say so, and to drop the Anthropic cap and key, which are no longer needed.
- All user-facing text in Spanish.

## Out of scope
- "Confirmar", saving sheets, the database and the list of preparations (spec 05).
- Method or steps, the course of the menu, allergens.
- Correcting the sheet by voice. Manual editing replaces it.
- Prices (spec 06) and costs (spec 07).
- Matching ingredients against a catalogue.
- Per-token daily caps and logging of call costs (spec 08).

## Acceptance criteria
Each one must be checkable with a test or a manual check.

- **04-C1**: After stopping a recording, a "Transcribir y crear ficha" button appears. Pressing it calls the transcription endpoint, then the structuring endpoint, both with the token through `client.ts`.
  - While waiting, it shows "Transcribiendo…" and then "Creando ficha…", and the button is disabled.
  - After a success the button stays disabled until a new recording (frontend tests with a fake API client).
- **04-C2**: The structuring endpoint calls the `Structurer` with the text and the model from the environment variable. Without `OPENAI_API_KEY` it answers 503. Tests use a fake `Structurer`: no test and no CI run calls OpenAI (pytest).
- **04-C3**: The model's output is validated with Pydantic. Output that does not match the schema (unknown unit, negative quantity, missing fields) gets a 502 and is never shown as a sheet (pytest with a fake that returns bad data).
- **04-C4**: Missing data is computed in code from the validated sheet: no yield, no covers, and each ingredient without a quantity or unit (pytest, table of cases).
- **04-C5**: The app shows the returned sheet as an editable form, with the values filled in, estimated values marked, and missing data marked. The transcript text is not shown (frontend tests).
- **04-C6**: The chef can:
  - change the name, the yield, the covers, and each ingredient's name, quantity, unit and estimated flag;
  - add an ingredient;
  - delete one with a single tap.

  Filling in an empty required field removes its missing mark, and emptying one adds it (frontend tests).
- **04-C7**: If transcription or structuring fails (provider error, timeout, invalid output or network error), the app shows a readable message, keeps the recording, and allows a retry.
  - If only structuring failed, the retry sends only the text again. The audio is not transcribed (and paid for) twice.
  - Error responses carry no API key or provider internals.
  - Empty text, or text over the length cap, is rejected with 422.

  (pytest and frontend tests)
- **04-C8**: Neither the transcript nor the sheet content is written to the logs. One log line per structuring call records the status, the text length, the duration, and the input and output tokens (pytest capturing logs). Manual checks:
  - On the deployed app, on the iPhone, a real preparation goes from dictation to a sheet the chef recognises, and can be fixed by editing.
  - The model trial has been run, and the chosen model is recorded in `docs/product/stack.md`.
  - The README says that the single OpenAI key and its $5/month cap cover transcription and structuring, and no Anthropic key or cap is mentioned any more.

## Edge cases
- The text is not a preparation (small talk, noise): the model returns a "not a preparation" flag, and the app shows "No parece una preparación" instead of an empty sheet. The chef records again.
- Silent audio ("No se ha detectado voz", spec 03): structuring is not called.
- Approximate quantities ("unos 300 gramos", "más o menos 2 kilos") get the estimated flag.
- Units outside the list ("un puñado", "una pizca"): the quantity and unit stay empty and are marked as missing. The ingredient name is kept as dictated.
- Covers dictated as a range ("30 o 40 raciones"): the lower value, marked as estimated.
- A new recording discards the current sheet and its edits, and clears the transcript. If a request for the old recording is still running, its result is ignored when it arrives.
- iOS may close the app in the background and lose unconfirmed edits. Accepted for now.
- Pressing the button twice quickly sends only one request.
- Cold start on Fly after idle: the client timeouts must allow for it, as in spec 03.
- The length cap must fit the transcript of a 2-minute voice note with margin. The exact value is set in the plan.
