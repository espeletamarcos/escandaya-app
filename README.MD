# Escandaya

Voice recipe sheets with cost per cover for tasting-menu kitchens.

## Run it

    make setup
    make dev-backend    # terminal 1, http://127.0.0.1:8000
    make dev-frontend   # terminal 2, http://localhost:5173

## Checks

    make test
    make lint

## Deploy

The app runs on Fly.io as one container (`escandaya`, region `cdg`): FastAPI serves the API under `/api` and the built frontend. Live at https://escandaya.fly.dev.

Pushes to `main` deploy automatically once the checks pass (`deploy` job in `.github/workflows/ci.yml`), then run the smoke test. It needs the `FLY_API_TOKEN` repository secret, created with:

    fly tokens create deploy -a escandaya

To deploy by hand:

    curl -L https://fly.io/install.sh | sh   # install flyctl once
    fly auth login
    fly deploy --ha=false                    # one machine
    scripts/smoke.sh                         # checks /api/health on the live URL

The machine stops when idle, so the first request after a pause is slow (a few seconds).
