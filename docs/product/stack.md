# Escandaya: tech stack

## Summary

A lightweight PWA frontend and a Python backend that holds all the logic. Pieces marked with a spec number are added when that spec needs them.

| Piece | Choice | Why | When |
| --- | --- | --- | --- |
| Frontend | React + Vite + TypeScript | Quick to build, typed, large ecosystem | In the skeleton |
| PWA | vite-plugin-pwa (manifest + service worker) | Installable on the phone without stores; can be wrapped with Capacitor later | In the skeleton |
| Backend | Python 3.12+ with FastAPI and uvicorn | Pydantic validation and good AI SDKs | In the skeleton |
| Packages | uv (backend), npm (frontend) | Isolated environments and pinned versions with `uv.lock` and `package-lock.json` | In the skeleton |
| Quality | pytest, ruff, ESLint | Tests and linters locally and in CI | In the skeleton |
| CI | GitHub Actions | Runs lint, tests and build on every push | In the skeleton |
| Database | SQLite with SQLAlchemy | One restaurant; can move to Postgres | Spec 04 |
| Speech to text | OpenAI transcription API | Good accuracy with kitchen noise | Spec 03 |
| Structuring | Claude with structured output (JSON) | Fast and cheap; estimated cost of $1-3/month per restaurant | Spec 04 |
| Hosting | Fly.io, Railway or Render | Automatic HTTPS, required for the microphone | Spec 02 |

## Repo layout and commands

```
escandaya-app/
├── backend/            Python project (pyproject.toml, uv.lock)
│   ├── src/backend/    the package: main.py with the FastAPI app
│   └── tests/          pytest tests
├── frontend/           Vite + React project
│   ├── public/         PWA icons
│   └── src/api/        client.ts, the only point of contact with the backend
├── specs/              README.md index and _template/ (spec.md, plan.md, tasks.md)
├── docs/               scope.md and stack.md
├── .github/workflows/  CI
├── CLAUDE.md           rules for Claude
└── Makefile            shortcuts
```

| Command | What it does |
| --- | --- |
| `make setup` | Installs backend and frontend |
| `make dev-backend` | Backend at http://127.0.0.1:8000 |
| `make dev-frontend` | Frontend at http://localhost:5173, with `/api` forwarded to the backend |
| `make test` | Backend tests |
| `make lint` | ruff and ESLint |
| `make build` | Production build of the PWA |

## Architecture rules

Four rules that are cheap today and expensive to change later:

1. **Logic lives in the backend.** Costs, validation and rules on the server; the frontend only displays and sends.
2. **A single API client** (`frontend/src/api/client.ts`). Changing the URL or adding authentication is done in one place.
3. **The microphone behind a `Recorder` interface.** It is what changes most between browser and native app.
4. **The LLM only returns JSON and our code decides.** It is validated with Pydantic and costs are always computed in code.

Also: API keys only in backend environment variables, and neutral domain names (`menu`, not `tasting_menu`) so we are not locked into tasting-menu kitchens.

## Open decisions

- [x] Hosting provider among Fly.io, Railway and Render (spec 02).
  - Fly.io, app `escandaya`, region `cdg`.
- [x] How front and back talk in production: same domain or CORS on the backend. The Vite proxy only exists in development.
  - FastAPI serves the built frontend and the API under `/api`, so no CORS is needed.
- [ ] Specific transcription and Claude models, after testing with real voice notes.
- [ ] Replace `httpx` with the client Starlette recommends in tests, when the deprecation warning requires it.
