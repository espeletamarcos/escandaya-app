# 05 – Plan

## Approach

### Backend
1. **Dependencies.** Add `sqlalchemy` and `alembic` to `backend/pyproject.toml` with `uv add` (approved 2026-11-14). The standard library's `sqlite3` driver is used, so no driver package is needed.
2. **Settings.** `settings.py` gets `DATABASE_PATH`.
   - Locally it defaults to `backend/data/escandaya.db`, and `backend/data/` is added to `.gitignore`.
   - On Fly, `fly.toml` sets `DATABASE_PATH = "/data/escandaya.db"` in `[env]`. This is not a secret.
3. **Database (`backend/src/backend/db.py`, new).**
   - `make_engine(path)` creates the parent folder if needed and returns a SQLAlchemy engine for `sqlite:///<path>`.
     - `hide_parameters=True`, so an error message never quotes the sheet or the transcript (05-C7).
     - Foreign keys switched on for each connection (`PRAGMA foreign_keys=ON`). SQLite leaves them off by default.
     - `check_same_thread=False`, because FastAPI runs sync endpoints in a thread pool. Each request still gets its own session.
   - `migrate(engine)` runs `alembic upgrade head` from code.
   - `get_session` is a FastAPI dependency that opens one session per request, from the engine on `app.state`.
4. **Tables (SQLAlchemy 2.0 typed models in `db.py`).** One row per preparation and one row per ingredient, not the sheet as a JSON blob. Spec 06 matches ingredients to prices and spec 07 adds up their costs, and both are easier with real rows.
   - `preparations`:
     - `id` (integer key).
     - `confirm_id` (text, unique).
     - `name`.
     - `yield_quantity`, `yield_unit`, `yield_estimated`.
     - `covers`, `covers_estimated`.
     - `transcript`.
     - `confirmed_at` (UTC, set by the backend).
   - `preparation_ingredients`:
     - `id`.
     - `preparation_id` (foreign key).
     - `position` (keeps the sheet's order).
     - `name`, `quantity`, `unit`, `estimated`.
   - The missing data is not stored. It is recomputed with `sheets.missing_fields` each time a sheet is read, so there is one source of truth (05-C2).
5. **Migrations (Alembic).**
   - Alembic's files live inside the package, `backend/src/backend/migrations/` (`env.py`, `script.py.mako`, `versions/`), so the Docker image already copies them.
   - `env.py` takes the engine from `migrate()` instead of reading a URL from `alembic.ini`. It uses `render_as_batch=True`, which lets later migrations change columns on SQLite.
   - The first migration creates both tables.
   - `create_app` gets a lifespan that runs `migrate()` at startup. On an up-to-date database, upgrading does nothing, so starting twice is safe (05-C5).
6. **`create_app(static_dir, database_path)`.** It builds the engine, stores it on `app.state`, runs migrations in the lifespan, and mounts the new router on the protected router. `main.app` passes `get_settings().database_path`.
7. **Endpoints (`backend/src/backend/preparations.py`, new).** All three are on the protected router, so they need the token (05-C3).
   - **`POST /api/preparations`.**
     - The body is `{"confirm_id": UUID, "transcript": str, "sheet": Sheet}`, validated with `extra="forbid"`.
       - The transcript is trimmed and must be 1–5,000 chars, reusing `structuring.MAX_TEXT_CHARS`.
       - `sheet` is the spec 04 `Sheet` model: strict types, fixed units, at most 100 ingredients.
       - Anything else gets 422. A `missing` list sent by the client is rejected by `extra="forbid"`; it is never read.
     - If `confirm_id` is already saved, it returns that preparation with `200`.
     - Otherwise it saves the preparation and returns `201`.
     - Two requests can arrive with the same id at the same moment. The unique constraint then raises `IntegrityError`, which is caught: the session rolls back and the saved row is returned.
     - The response is `{"id", "confirmed_at", "sheet", "missing"}`.
   - **`GET /api/preparations`.**
     - Returns `[{"id", "name", "covers", "missing_count", "confirmed_at"}]`.
     - Ordered by `confirmed_at` descending, then `id` descending, so two confirms in the same second keep their order.
     - `covers` is the number or `null`.
     - Ingredients are loaded in one extra query (`selectinload`) to count the missing data.
   - **`GET /api/preparations/{preparation_id}`.**
     - Returns the same shape as the confirm response. The transcript is not returned, because no screen shows it.
     - The id is read as text: anything that is not a positive whole number, or an unknown id, gets 404. With a plain `int` parameter FastAPI would answer 422 to a malformed id.
   - `confirmed_at` is sent as ISO 8601 with its offset (`...Z`), so the phone shows it in its local time.
8. **Logs (05-C7).** One line per request, written in a `finally` block as in transcription:

   `preparations action=confirm|list|detail status=%d duration_ms=%s`

   A confirm that returns an existing copy logs `status=200`, so repeats show up. Tests use `caplog` and assert that neither the transcript nor the ingredient names appear in the logs, including after a 422.
9. **Tests.**
   - The `make_client` fixture gets a temporary database in `tmp_path` for each test. It starts the app (enters the `TestClient`), so migrations run as they do in production.
   - `test_db.py` covers migrating twice on the same file: no error, and a saved row is still there (05-C5).

### Frontend
1. **Types (`frontend/src/preparations/types.ts`, new).**
   - `SavedPreparation`: `{ id, confirmed_at, sheet, missing }`.
   - `PreparationSummary`: `{ id, name, covers, missing_count, confirmed_at }`.
2. **`client.ts`.**
   - `confirmPreparation({ confirmId, transcript, sheet })` returns a `SavedPreparation`. Its timeout is 20s: the backend makes no provider call, but the machine may be starting cold.
   - `listPreparations()` returns `PreparationSummary[]`, and `getPreparation(id)` returns a `SavedPreparation`. Both time out at 20s.
   - Each response gets a shape check, reusing `isSheet`, as `createDraft` does.
   - A new error kind, `invalid`, is used for 422, so the confirm step can say "hay valores no válidos" instead of a generic failure. `createDraft` never gets a 422 in practice: an empty transcript stops at "No se ha detectado voz". If it did, it would show the generic sheet error.
3. **From the form to a sheet (`sheetEditor.ts`).**
   - `toSheet(editable): Sheet`:
     - trims the names;
     - reads quantities and covers with the existing parsers, so text that is not a number becomes `null` (missing);
     - turns the empty unit `""` into `null`.
   - `canConfirm(editable)`: false while the name or an ingredient name is empty (05-C1).
   - Both are pure functions with unit tests.
4. **Confirming (`frontend/src/preparations/useConfirm.ts`, new).**
   - The hook takes the injected `confirmPreparation`, the transcript and an `onSaved` callback.
   - It makes one confirm id with `crypto.randomUUID()` when it mounts, and keeps it. It is mounted once per sheet, so a new sheet gets a new id.
   - `confirm(sheet)` is ignored while a request is pending, using a ref guard as in `useVoiceSheet`. On an error it shows a Spanish message for that error kind. The retry keeps the same id.
5. **`SheetForm`.**
   - Gets the props `onConfirm(sheet)`, `confirming` and `confirmError`.
   - A "Confirmar" button sits at the bottom. It is disabled while `confirming` or when `canConfirm` is false. While confirming it shows "Guardando…".
   - The edits stay in the form's reducer, so an error keeps them (05-C1).
   - `RecordScreen` renders the form through a small `DraftSheet` component. It holds `useConfirm`, and is keyed by `draftId` as the form already is, so each new sheet gets a new confirm id.
6. **After saving.** `RecordScreen` gets an `onSaved` prop. `App` then:
   - shows "Ficha guardada" on the list;
   - remounts `RecordScreen` with a new React `key`, which clears the recording, the transcript and the sheet without adding a `clear()` to `useRecorder`.
7. **Navigation (`App.tsx`).**
   - Once unlocked, `App` keeps a view: `record`, `list`, or `detail` with an id.
   - Two buttons at the top switch between "Grabar" and "Preparaciones". This is the minimal layout; the bottom navigation comes with the styling spec.
   - `RecordScreen` stays mounted (hidden) while the list is open, so an unconfirmed sheet is not lost by looking at the list.
   - No URL routing and no new dependency.
8. **List (`frontend/src/screens/PreparationsScreen.tsx`, new).**
   - Loads the list on mount, with the client function injected for tests.
   - States: "Cargando…", error with "Reintentar", "Aún no hay preparaciones", or the list.
   - Each item is a button showing:
     - the name;
     - "40 raciones", or "Raciones: falta";
     - "Faltan 3 datos", or "Completa";
     - the date, formatted with `Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" })`.
   - An optional `notice` prop shows "Ficha guardada".
9. **Read-only sheet (`frontend/src/sheet/SheetView.tsx` and `frontend/src/screens/PreparationScreen.tsx`, new).**
   - `SheetView` shows the name, yield, covers and ingredients, with "(estimado)" on estimated values and "Falta" on each path in the backend's `missing` list. It is a separate component, not a read-only mode of `SheetForm`: it has no inputs and no edit state.
   - `PreparationScreen` loads one preparation by id, with the same loading and error states as the list, and has a "Volver" button back to the list.

### Fly and backups
1. **Volume.**
   - `fly volumes create escandaya_data --region cdg --size 1` creates a 1 GB volume. This is a change to the live app, so it is run with your go-ahead.
   - `fly.toml` gets `[mounts] source = "escandaya_data", destination = "/data"`.
   - The volume must exist before the change reaches `main`, because pushes to `main` deploy from CI.
2. **Backup script (`backend/src/backend/backup.py`, new).**
   - `python -m backend.backup <destination>` copies the live database with SQLite's online backup API (`sqlite3.Connection.backup`). The copy is consistent even if a request writes while it runs.
   - The image has Python but not the `sqlite3` command-line tool, which is why the copy is done from Python.
   - The steps, in the README:
     - `fly ssh console -C "python -m backend.backup /data/backup.db"`;
     - `fly ssh sftp get /data/backup.db`;
     - open the copy locally with `sqlite3` or Python.
3. **Snapshot retention.** Fly snapshots volumes daily. The retention is read with `fly volumes show` and written in the README, with how to change it (`fly volumes update --snapshot-retention`).
4. **Smoke test.** `scripts/smoke.sh` also checks that `GET /api/preparations` without a token returns 401.

Mapping to criteria:
- 05-C1: `useConfirm`, `SheetForm` and `RecordScreen` tests with a fake `confirmPreparation`. They check the payload, the pending state, a double tap, keeping the edits and the same id after an error, and `onSaved` after a success. `sheetEditor` tests cover `toSheet` and `canConfirm`.
- 05-C2: pytest. Invalid sheets get 422 (unknown unit, negative quantity, extra field, too many ingredients, transcript over the cap). A `missing` sent by the client is rejected. A round trip through confirm and detail keeps every field and the order. The same `confirm_id` twice gives one row and the same id back.
- 05-C3: pytest. Newest first, the summary fields, 404 for an unknown or malformed id, 401 on all three without a token.
- 05-C4: `PreparationsScreen`, `PreparationScreen`, `SheetView` and `App` tests with fake client functions. They cover the empty state, the error and retry, opening an item, going back, and switching views while keeping an unconfirmed sheet.
- 05-C5: `test_db.py`, and a lifespan test that starts the app twice on one file.
- 05-C6: manual check on Fly, recorded in `tasks.md`.
- 05-C7: pytest with `caplog`.
- 05-C8: the README, and a manual check recorded in `tasks.md`.

## Alternatives considered
- **The sheet as one JSON column:** less code now, but spec 06 needs ingredient rows to attach prices to, so it would start with a data migration. Discarded.
- **Storing the missing count:** saves a query, but it is a second copy of what `missing_fields` computes, and it can go stale if the rules change. The data is small. Discarded.
- **`Base.metadata.create_all()` instead of Alembic:** simpler, but it cannot add a column to an existing table, which spec 06 will need. Discarded, as the spec requires migrations.
- **A client router (`react-router`):** a new dependency for three views with no deep links. Discarded for now. Revisit with the styling spec's bottom navigation if needed.
- **A read-only mode in `SheetForm`:** mixes two jobs into one component, and the read-only view must show the backend's missing list, not the form's display marks. Discarded.
- **A new confirm id after every edit:** a retry after an edit would then save a copy next to the earlier one, and copies cannot be deleted. Discarded. The spec keeps one id per sheet.
- **A plain copy of the database file (`cp`):** may copy a half-written file during a write. Discarded in favour of the backup API.

## Files touched
- `backend/pyproject.toml`, `backend/uv.lock`: `sqlalchemy`, `alembic`.
- `backend/src/backend/settings.py`: `DATABASE_PATH`.
- `backend/src/backend/db.py` (new): engine, tables, `migrate`, `get_session`.
- `backend/src/backend/migrations/` (new): Alembic `env.py`, template, first migration.
- `backend/src/backend/preparations.py` (new): request and response models, three endpoints, log line.
- `backend/src/backend/backup.py` (new): the backup command.
- `backend/src/backend/main.py`: `create_app(static_dir, database_path)`, lifespan, router.
- `backend/tests/conftest.py`: temporary database in `make_client`, settings field.
- `backend/tests/`: `test_db.py`, `test_preparations.py`, `test_backup.py` (new); `test_settings.py`.
- `frontend/src/api/client.ts` and `client.test.ts`: three functions, response checks, `invalid` kind.
- `frontend/src/preparations/` (new): `types.ts`, `useConfirm.ts`, and tests.
- `frontend/src/sheet/`: `sheetEditor.ts` (`toSheet`, `canConfirm`), `SheetForm.tsx`, `SheetView.tsx` (new), and tests.
- `frontend/src/screens/`: `RecordScreen.tsx`, `PreparationsScreen.tsx` and `PreparationScreen.tsx` (new), and tests.
- `frontend/src/App.tsx` and `App.test.tsx`: views and navigation.
- `fly.toml`: `[mounts]`, `DATABASE_PATH`.
- `.gitignore`: `backend/data/`.
- `scripts/smoke.sh`, `README.MD`, `docs/product/stack.md` (the Database row).
- `specs/README.md`, `spec.md`, `tasks.md`: status and checks.

## Risks
- **Attaching a volume to the existing machine.** The current machine was created without a volume. If `fly deploy` will not add the mount to it, the machine is destroyed and recreated with the volume. Nothing is lost, because nothing is stored yet. Done by hand before the merge, with your go-ahead.
- **A retry with the same id after further edits.** If a confirm timed out but did save, and the chef then edits and retries, the backend returns the earlier version and the later edits are not saved. This is rare (a timeout that saved, plus an edit), and the list shows what was saved. A duplicate would be worse, since nothing can be deleted yet.
- **`strict=True` on the request body.** The spec 04 models are strict. JSON numbers and booleans pass, but if FastAPI hands the body over in a way strict mode rejects (for example, `40` for a float field), valid sheets would get 422. The first backend test of the confirm endpoint shows this at once. The fix would stay in `preparations.py`.
- **Startup time.** Migrations run on every start, and a cold start already takes a few seconds. An up-to-date database makes it a quick version check. The 20s client timeouts and the 10s Fly health-check grace cover it, and it is checked on the phone after an idle stop (05-C6).
- **Memory.** The machine has 256 MB. SQLAlchemy and Alembic add a few tens of MB at import. Checked with `fly status` and the logs after the deploy.
- **The volume is one disk on one host.** If the host fails, the data comes back from the latest daily snapshot or from a manual copy (05-C8). This is acceptable for the MVP.
- **No browser back button.** The views are not in the URL, so the iOS back swipe does not move between them. Fine while the app is opened from the home screen. Revisit with the styling spec.
