# 05 – Tasks

## Backend
- [ ] Add `sqlalchemy` and `alembic` with `uv add`. Write tests, then add `DATABASE_PATH` to `settings.py` (default `backend/data/escandaya.db`) and to `conftest.make_settings`, and add `backend/data/` to `.gitignore` (05-C5)
- [ ] Add `db.py`:
  - `make_engine(path)`: creates the folder, `hide_parameters=True`, foreign keys on, `check_same_thread=False`.
  - The `preparations` and `preparation_ingredients` tables as SQLAlchemy 2.0 typed models.
  - `get_session` as a FastAPI dependency reading the engine from `app.state`.

  (05-C2)
- [ ] Write tests, then set up Alembic inside the package (`backend/src/backend/migrations/`, `render_as_batch=True`, engine passed from code), add the first migration with both tables, and `migrate(engine)`. Migrating twice on the same file does not fail and keeps a saved row (05-C5)
- [ ] Write tests, then change `create_app(static_dir, database_path)`: build the engine, run `migrate()` in the lifespan, and give `make_client` a temporary database per test that runs the app's startup. Starting the app twice on one file keeps its data (05-C5)
- [ ] Write tests, then add `POST /api/preparations` on the protected router:
  - Body `{confirm_id, transcript, sheet}` with `extra="forbid"`; the transcript trimmed, 1–5,000 chars; the sheet validated with the spec 04 `Sheet` model. Otherwise 422.
  - Save the preparation, its ingredients in order and `confirmed_at` (UTC). Return `201 {id, confirmed_at, sheet, missing}`, with `missing` from `missing_fields`.
  - A known `confirm_id` returns the saved preparation with `200`, and an `IntegrityError` from a race does the same after a rollback.

  (05-C2)
- [ ] Write tests, then add `GET /api/preparations` (newest first, with `id`, `name`, `covers`, `missing_count`, `confirmed_at`) and `GET /api/preparations/{id}` (the confirm response shape; 404 for an unknown or malformed id). All three endpoints return 401 without a token (05-C3)
- [ ] Write tests with `caplog`, then add the log line `preparations action=%s status=%d duration_ms=%s` to the three endpoints. Assert that the transcript and the ingredient names never appear in the logs, including after a 422 (05-C7)
- [ ] Write a test, then add `backend/backup.py`: `python -m backend.backup <destination>` copies the database with SQLite's backup API (05-C8)

## Frontend
- [ ] Write tests, then add `confirmPreparation`, `listPreparations` and `getPreparation` to `client.ts`, with 20s timeouts, response shape checks reusing `isSheet`, and the `invalid` error kind for 422. Add the types in `frontend/src/preparations/types.ts` (05-C1, 05-C4)
- [ ] Write tests, then add `toSheet(editable)` and `canConfirm(editable)` to `sheetEditor.ts`: trimmed names, unreadable numbers as `null`, the empty unit as `null`, and no confirm while a name is empty (05-C1)
- [ ] Write tests, then add `useConfirm`: one `crypto.randomUUID()` per mount, a pending guard against double taps, Spanish error messages per error kind, the same id on retry, and `onSaved` after a success (05-C1)
- [ ] Write tests, then add the "Confirmar" button to `SheetForm` (disabled while confirming or when `canConfirm` is false, "Guardando…" while pending, the error shown and the edits kept), and render it from `RecordScreen` through a `DraftSheet` component keyed by `draftId` (05-C1)
- [ ] Write tests, then add `SheetView`: the sheet read-only, with "(estimado)" on estimated values and "Falta" on each path in the backend's `missing` list (05-C4)
- [ ] Write tests, then add `PreparationsScreen` (loading, error with "Reintentar", "Aún no hay preparaciones", the list with name, covers, missing count and date, and the "Ficha guardada" notice) and `PreparationScreen` (one preparation through `SheetView`, with "Volver") (05-C4)
- [ ] Write tests, then add the views to `App`: "Grabar" and "Preparaciones" buttons, `RecordScreen` kept mounted while the list is open, opening and leaving a preparation, and after a save, a new `RecordScreen` and the list with "Ficha guardada" (05-C1, 05-C4)

## Fly, backups and checks
- [ ] With your go-ahead, create the volume (`fly volumes create escandaya_data --region cdg --size 1`). Add `[mounts]` and `DATABASE_PATH` to `fly.toml`, and the 401 check for `GET /api/preparations` to `scripts/smoke.sh`. Deploy, recreating the machine if the mount cannot be added to the current one (05-C6)
- [ ] Update the README (where the database lives, the backup steps, the snapshot retention from `fly volumes show` and how to change it) and the Database row in `docs/product/stack.md` (05-C8)
- [ ] Manual checks on the iPhone, recorded here with the date:
  - Confirm a real sheet, see it in the list and open it.
  - It is still there after a deploy, and after the machine stops when idle.
  - The logs show only `preparations` lines with status and duration.
  - A backup copied off the volume opens locally.

  (05-C6, 05-C7, 05-C8)
- [ ] Update the status of spec 05 in `specs/README.md` as it moves to `in progress` and `implemented`
