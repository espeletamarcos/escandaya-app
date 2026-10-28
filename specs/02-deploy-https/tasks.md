# 02 – Tasks

- [x] Get approval to add the Dockerfile, the provider config and the deploy secret in CI, and confirm Fly.io as the provider (all criteria, enabler)
  - Approved: Fly.io, `Dockerfile`, `.dockerignore`, `fly.toml`, and a Fly deploy token as a CI secret. Both manual (`fly deploy`) and CI deploys.
- [x] Write tests, then mount the API under `/api` in `main.py` and update the health test to `/api/health` (02-C2)
  - Also removed the `/api` rewrite from the Vite dev proxy, so dev and production use the same paths.
- [x] Write tests, then serve `frontend/dist` from FastAPI with an `index.html` fallback that does not apply under `/api` (02-C1, 02-C2)
  - The folder comes from `FRONTEND_DIST`, or `frontend/dist` in the repo. Missing files with an extension return 404 instead of `index.html`.
- [x] Add a multi-stage `Dockerfile` and `.dockerignore`, and check that the image runs locally over plain HTTP (02-C1)
- [x] Create the Fly.io app, add `fly.toml`, and deploy by hand; the app opens on its `https://` URL (02-C1, 02-C2)
  - App `escandaya` at https://escandaya.fly.dev, region `cdg` (`mad` is deprecated for new machines). Deployed with `fly deploy --ha=false` so there is one machine.
- [x] Add a smoke test script that checks the deployed `/api/health` returns `{"status": "ok"}` (02-C2)
  - `scripts/smoke.sh [base-url]`, default `https://escandaya.fly.dev`. Retries 5 times because the machine auto-stops when idle.
- [ ] Add a deploy job in CI that runs after the checks pass on `main`, and document the manual `fly deploy` steps in `README.MD` (02-C5)
- [ ] Manual check on Android Chrome and iOS Safari: the app opens over HTTPS and loads without errors; note results in this file (02-C1)
- [ ] Manual check of recording on both phones: permission prompt, record, stop, playback, and the denied-permission message; note results here and in `specs/01-record-audio/tasks.md` (02-C3)
- [ ] Manual check that the app installs to the home screen and opens in standalone mode, including recording in the installed app on iOS (02-C4)
- [ ] Deploy twice and check that the phone picks up the new build without clearing site data (edge case: stale service worker)
- [ ] Tick the open decisions in `docs/product/stack.md` and update the statuses of specs 01 and 02 in `specs/README.md`
