# Escandaya

Voice recipe sheets with cost per cover for professional kitchens (first user: a tasting-menu restaurant).
PWA: React + Vite + TypeScript frontend, Python 3.12+ FastAPI backend.

## How we work

- Spec-driven: no feature without an approved spec in `specs/NN-name/`.
  Flow: `spec.md` -> `plan.md` -> `tasks.md`.
- Before starting any spec, read `docs/scope.md`, `docs/stack.md` and `specs/README.md`.
- One task at a time. Explain the plan before writing code. Keep diffs small.
- Write the test first when there is logic.
- Do only what the spec or the task asks. If something else seems useful, propose it and wait.
- When finishing a task, list any decision you took that was not requested.

## Code rules

- All code, comments, specs and docs in English.
- The LLM only returns data (JSON). Our code validates it and decides. Costs are always computed in code, never by the LLM.
- Business logic lives in the backend. The frontend is thin and calls the backend only through `frontend/src/api/client.ts`.
- API keys only in backend environment variables, never in the frontend.
- Use neutral domain names (`menu`, `preparation`, `ingredient`), not `tasting_menu`.

## Boundaries

- Never run `git commit` or `git push`. Show the diff and I will commit.
- Ask before adding a dependency or changing project configuration.
- Update the status of the spec in `specs/README.md` when it changes.

## Layout

- `backend/src/backend/`: FastAPI app. Tests in `backend/tests/`.
- `frontend/src/`: React app. Backend calls only in `frontend/src/api/client.ts`.
- `specs/`: one folder per spec. `docs/`: scope and stack.

## Commands

- `make test`, `make lint`, `make build`
- `make dev-backend`, `make dev-frontend`