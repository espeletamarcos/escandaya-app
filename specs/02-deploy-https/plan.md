# 02 – Plan

## Approach
Serve the built frontend from the FastAPI app, so one service gives one origin over HTTPS. The frontend already calls `/api/...` through `client.ts`; in development Vite strips the `/api` prefix and forwards to the backend. In production the backend does the same:

1. Mount the API under `/api` (an `APIRouter` or a mounted sub-app), keeping `/health` working at `/api/health`.
2. Serve `frontend/dist` as static files with an `index.html` fallback, so the PWA manifest, service worker and icons come from the same origin.
3. Build everything in one container image: a Node stage runs `npm ci && npm run build`, a Python stage runs `uv sync --frozen` and copies `dist` in. Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
4. Deploy the image to the hosting provider, which terminates TLS and gives an `https://` URL.
5. Deploy from `main` after CI passes, using a Fly deploy token stored as a GitHub secret, and also keep a documented manual `fly deploy` (02-C5). Decided: both.

No CORS and no change to `client.ts` or the Vite config are needed, because the browser sees a single origin. This settles the open decision "same domain or CORS" in `docs/product/stack.md`.

Mapping to criteria:
- 02-C1, 02-C3, 02-C4: come from serving the PWA over HTTPS; verified by hand on real phones.
- 02-C2: the deployed app calls `/api/health` via `getHealth()`. A smoke test script checks the deployed URL returns `{"status": "ok"}`.
- 02-C5: provider deploy command in CI or a short README section.

## Alternatives considered
- **Separate frontend host (static) and backend host, with CORS.** Discarded: two deploys, two URLs, CORS config and an API base URL per environment, all for one restaurant. It would also change `client.ts`.
- **Reverse proxy (Caddy/nginx) in front of both.** Discarded: one more moving part to run and update, with no benefit while FastAPI can serve static files.
- **Tunnel (ngrok / Cloudflare Tunnel) from the laptop.** Discarded as the deliverable: it works for a quick mic check but is not a deployment, and the URL dies with the laptop. It stays useful as a shortcut if provider setup drags.

### Provider
All three give automatic HTTPS and deploy a Dockerfile. Pricing and free tiers change often, so check the current terms before committing.

| Provider | For | Against |
| --- | --- | --- |
| Fly.io | Machines can stop and start fast; persistent volumes are available for SQLite in spec 04 | CLI-driven setup; free allowance has been reduced over time |
| Railway | Simple setup from a GitHub repo; volumes available | Trial or usage-based pricing instead of a stable free tier |
| Render | Easiest web service setup; free tier is available | Free web services sleep after idle, with cold starts around a minute; persistent disks are paid |

Decision: **Fly.io**, because spec 04 needs a persistent volume for SQLite and Fly handles that with the same setup. Approved by the user.

## Files touched
- `backend/src/backend/main.py`: mount the API under `/api`, serve `frontend/dist` with an `index.html` fallback.
- `backend/tests/`: tests for `/api/health`, and that unknown non-API paths return `index.html`.
- `Dockerfile` and `.dockerignore` (repo root): multi-stage build.
- Provider config (for Fly.io, `fly.toml`).
- `.github/workflows/`: deploy job after CI passes (if automatic deploy is chosen).
- `README.MD`: deploy section with the exact steps.
- `docs/product/stack.md`: tick the two open decisions (provider, same domain).
- `specs/README.md`: status of spec 02 and, once the phone check passes, spec 01.
- `specs/01-record-audio/tasks.md`: record the mobile check results.

## Risks
- **iOS Safari quirks:** recording format, and standalone PWA mic permission differ from the browser. Spec 01 already picks the mime type at runtime; the phone check is where this shows up.
- **Service worker caching a stale build** after redeploy. `autoUpdate` should handle it; verify by deploying twice.
- **Static fallback swallowing API 404s:** the `index.html` fallback must not apply under `/api`.
- **Cold starts** if the machine auto-stops: the first load is slow. Acceptable for the MVP, but note it in the README.
- **Public URL without a token** until spec 03. Nothing sensitive exists yet, and the URL is not shared widely.
- **Dependency and config changes** (Docker, provider CLI, a CI deploy secret) were approved in task 1.
- **CI deploy token:** a leaked or over-broad token can deploy to the app. Use a token scoped to this app only, stored as a GitHub secret, never in the repo.
- **Moving the API under `/api`** changes the backend's route layout; the existing health test must be updated with it.
