# Escandaya

Voice recipe sheets with cost per cover for tasting-menu kitchens.

## Run it

    make setup
    make dev-backend    # terminal 1, http://127.0.0.1:8000
    make dev-frontend   # terminal 2, http://localhost:5173

The API needs a token, and transcription needs an OpenAI key (see [Access and secrets](#access-and-secrets)). Locally, start the backend with them in the environment instead of `make dev-backend`, and open http://localhost:5173/?token=dev-token:

    cd backend && ACCESS_TOKENS=dev-token OPENAI_API_KEY=sk-... uv run uvicorn backend.main:app --reload

Without `OPENAI_API_KEY` everything works except transcription, which answers 503.

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
    scripts/smoke.sh                         # checks /api/health, and that /api/session needs a token, on the live URL

The machine stops when idle, so the first request after a pause is slow (a few seconds).

## Access and secrets

The app is private: every `/api` call except `/api/health` needs a token from the `ACCESS_TOKENS` list. The configuration lives only in Fly secrets, never in the repo:

| Secret | What it is |
| --- | --- |
| `ACCESS_TOKENS` | Comma-separated access tokens, one per person. Empty or unset rejects everyone. |
| `OPENAI_API_KEY` | Key of the `escandaya` project in the OpenAI platform, used for transcription. |
| `TRANSCRIPTION_MODEL` | Optional. Defaults to `gpt-4o-mini-transcribe`. |

Fly never shows a secret's value again, so keep each token (or its private link) in a password manager. Start the commands below with a space, so the values stay out of the shell history.

### Tokens

Generate one token per person:

    python3 -c "import secrets; print(secrets.token_urlsafe(32))"

Set the full list. `fly secrets set` replaces the whole value, so include every token to keep:

     fly secrets set ACCESS_TOKENS='token-marcos,token-chef'

Send each person their private link, through a private channel:

    https://escandaya.fly.dev/?token=<their token>

Opening it once stores the token in that browser and removes it from the address bar. It is needed again on a new phone or browser, after clearing site data, or in the home-screen app on iOS, which may not share storage with Safari: there, paste the link or the token in the "Acceso privado" screen.

The first visit may stay in the browser history with the token in the URL. On a shared device, delete that history entry.

To revoke someone, set the list again without their token. The next request from their device shows the block screen. A lost token is handled the same way: generate a new one and replace it.

### OpenAI key

Create the key in the `escandaya` project of the OpenAI platform and set it:

     fly secrets set OPENAI_API_KEY='sk-...'

If it leaks, create a new key, set it the same way, then delete the old one in the OpenAI dashboard. For the model trial (`scripts/transcribe_trial.py`), use a separate key and delete it afterwards.

### Spending caps

- OpenAI: $5/month budget on the organization and on the `escandaya` project. Keep automatic credit recharge off.
- Anthropic: $5/month cap, to set when spec 04 starts calling Claude.
