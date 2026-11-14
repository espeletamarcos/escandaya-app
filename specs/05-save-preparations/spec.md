# 05 – Save preparations

Status: approved

## Why
The editable sheet from spec 04 is lost as soon as the chef records again. To load a whole menu, sheets must be confirmed, kept and found again. This spec adds a "Confirmar" button, the database and the list of saved preparations, so prices and costs (specs 06 and 07) have something to work on.

## Scope
- SQLite with SQLAlchemy in the backend, and Alembic for migrations (two new backend dependencies). On Fly, the database file lives on a persistent volume.
- A "Confirmar" button at the bottom of the editable sheet from spec 04. It sends the edited sheet, its transcript and a confirm id through `client.ts`. The confirm id is made once per sheet on the phone, so sending the same sheet again (a double tap, or a retry after a timeout where the save did happen) does not create a second copy.
- The backend validates the confirmed sheet with the same Pydantic models as spec 04 (`backend/src/backend/sheets.py`), recomputes the missing data in code, and saves it.
- Backend endpoints to confirm (save) a preparation, list the saved ones, and get one by id. All of them require the token.
- A list screen with the saved preparations (name, covers, number of missing data items, date confirmed), newest first. Tapping one opens its sheet read-only, with its missing data marked.
- Simple navigation between the record screen and the list. The full bottom navigation (Menu, Recipe sheet, Prices) and its look belong to the styling spec.
- Database schema changes go through migrations, so later specs can add tables without losing data.
- Backups: a documented way to copy the database off the Fly volume, and the volume snapshot retention noted in the README.
- All user-facing text in Spanish.

## Out of scope
- Editing a sheet once it is confirmed, and deleting saved preparations. Revisit once the chef uses the app.
- Grouping preparations by course, and the full Menu screen with costs (spec 07).
- Prices and ingredients as their own catalogue (spec 06).
- Saving the audio.
- Multiple restaurants, or storing who confirmed each preparation.
- Moving to Postgres.
- Visual styling beyond the minimum layout (styling spec, after this one).

## Acceptance criteria
Each one must be checkable with a test or a manual check.

- **05-C1**: The editable sheet has a "Confirmar" button that sends the edited sheet, its transcript and its confirm id through `client.ts`. While waiting, a pending state is shown and the button is disabled.
  - The button is disabled while the name or an ingredient name is empty, because the backend would reject the sheet. Empty quantities, units, yield and covers do not block it: they are missing data.
  - After a success, the app shows "Ficha guardada", clears the recording and the sheet, and opens the list.
  - After an error, the sheet and its edits are kept, and the chef can retry with the same confirm id.

  (frontend tests)
- **05-C2**: The backend validates the confirmed sheet with the spec 04 Pydantic models and rejects invalid sheets with 422. It recomputes the missing data in code, ignoring any sent by the client. It saves the sheet (name, yield, covers, ingredients with quantity, unit and estimated flag, in order), the transcript and the confirmation time. A second confirm with the same confirm id returns the preparation already saved and does not create another (pytest against a temporary SQLite database).
- **05-C3**: The list endpoint returns the saved preparations newest first, with id, name, covers, number of missing data items and confirmation time. The detail endpoint returns the full sheet with its missing data, or 404 for an unknown id. All three endpoints return 401 without a token (pytest).
- **05-C4**: The list screen shows the saved preparations, and an empty state ("Aún no hay preparaciones") when there are none. Tapping one opens its sheet read-only, with missing data marked. If loading fails, a readable message and a retry are shown. The chef can move between recording and the list (frontend tests with a fake API client).
- **05-C5**: The database is created and upgraded by migrations when the app starts. Starting twice does not fail or lose data (pytest).
- **05-C6**: On Fly, the database is on a persistent volume: a preparation confirmed before a deploy, and before the machine stops when idle, is still there afterwards (manual check).
- **05-C7**: The transcript and the sheet content are not written to the logs. Each confirm, list or detail request logs only its status and duration (pytest capturing logs).
- **05-C8**: The README documents where the database lives, how to copy it off the volume, and the snapshot retention. A copy has been made and opened locally once (manual check).

## Edge cases
- Pressing "Confirmar" twice quickly saves only one copy: the button is disabled while pending, and the confirm id covers anything that gets through.
- A timeout on confirm where the backend did save: the retry sends the same confirm id and gets the saved preparation back, not a copy.
- A sheet with missing data can be confirmed. The missing data stays visible in the list and in the sheet.
- Confirming a sheet created again from the same transcript (a new structuring, so a new confirm id) creates a second preparation. Duplicates are allowed. Deleting them is out of scope.
- Two preparations with the same name are allowed and are told apart by their date.
- The sheet the client sends is untrusted: the backend validates it the same way as the model's output (strict types, fixed units, at most 100 ingredients), and caps the transcript at the same length as structuring (5,000 characters).
- An unknown or malformed preparation id in the detail URL gets 404, not a server error.
- The volume ties the app to one machine. Running more than one machine is out of scope (`fly deploy --ha=false` already holds this).
- The machine starts cold with the database on the volume: the first request may be slow, and must not show an error before the client timeout.
