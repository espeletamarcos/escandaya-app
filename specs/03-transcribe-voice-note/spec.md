# 03 – Transcribe a voice note

Status: in progress

## Why
The chef already records on the phone (spec 01, deployed in spec 02), but the audio goes nowhere. This spec sends a recording to the backend and shows the Spanish text, so we learn whether transcription is accurate enough in a real kitchen before building the recipe sheet on top of it (spec 04). This is the first spec that spends money on an external API, so it also adds minimal protection: a private link with an access token, and spending caps in the provider consoles.

## Scope
- A "Transcribe" button after stopping a recording. It sends the audio through `frontend/src/api/client.ts` and shows the returned text, read-only, under the player.
- A backend endpoint that receives the audio, calls the OpenAI transcription API with the language fixed to Spanish (`es`), and returns the text.
- The OpenAI call behind a `Transcriber` interface, with an OpenAI implementation and a fake for tests.
- The transcription model set by a backend environment variable. The model is chosen after trying real voice notes, and the choice is recorded in `docs/product/stack.md`.
- A 2-minute limit per voice note: the recording stops by itself at 2:00, and the backend rejects uploads above a matching size cap.
- Access token:
  - The private link carries the token (`/?token=...`). The app stores it in `localStorage`, removes it from the address bar, and sends it as an `Authorization` header through `client.ts`.
  - The backend accepts a short list of valid tokens from an environment variable (comma-separated), so each one can be revoked on its own.
  - Every `/api` route except `/api/health` requires a valid token. The static frontend stays public.
  - A protected `GET /api/session` endpoint, called when the app opens, to check the stored token.
  - Without a valid token, the app shows a block screen instead of the record screen. The block screen has a field to paste the private link or the token.
  - The token never appears in the server logs.
- Spending caps of $5/month in the OpenAI and Anthropic consoles, with API keys stored only as Fly secrets.
- README notes: how to issue and revoke a token, and the spending caps.
- All user-facing text in Spanish, including the existing spec 01 messages. Code, comments and docs stay in English.

## Out of scope
- Storing audio or transcripts: nothing is saved on disk or in a database (spec 04 adds the database).
- Structuring the text into a recipe sheet or calling Claude (spec 04).
- Editing or copying the transcript.
- Per-token daily call caps and logging of call costs (spec 08).
- Languages other than Spanish.
- Accounts, passwords, roles or multiple restaurants.
- Offline transcription or queueing recordings to send later.

## Acceptance criteria
Each one must be checkable with a test or a manual check.

- **03-C1**: Opening the app from `/?token=X` stores `X`, removes the token from the address bar, and later opens without the parameter keep working (unit test; manual check on a real phone, including the installed PWA).
- **03-C2**: When the app opens it calls `GET /api/session`. If there is no stored token, or the backend answers 401, the stored token is cleared and a block screen says to open the app from the private link. Pasting a valid link or token in the block screen field unlocks the app (unit tests with a fake API client).
- **03-C3**: Every `/api` route except `/api/health` returns 401 without a valid token. Each token in the configured list is accepted. If the list is empty or unset, every protected route returns 401. `/api/health` and the static frontend stay public (pytest).
- **03-C4**: After stopping a recording, a "Transcribe" button appears. Pressing it sends the audio with the token through `client.ts`. While waiting, a pending state is shown and the button is disabled. When the response arrives, the text is shown read-only under the player, and the button stays disabled until a new recording, so the same audio is not transcribed (and paid for) twice (frontend tests).
- **03-C5**: The backend endpoint accepts both `audio/webm` (Chrome, and recent iOS Safari) and `audio/mp4` (older iOS Safari) and calls the `Transcriber` with language `es` and the model from the environment variable. Tests use a fake `Transcriber`: no test and no CI run calls OpenAI (pytest).
- **03-C6**: Recording stops by itself at 2:00 with a visible notice, and the audio is kept. The backend rejects uploads above the size cap with 413, and the app shows a readable message (frontend test and pytest).
- **03-C7**: If transcription fails (OpenAI error, timeout or network error), the app shows a readable message, keeps the recording, and lets the chef press "Transcribe" again. Backend error responses do not include the API key or provider internals (frontend test and pytest with a failing fake).
- **03-C8**: Neither the token nor the transcript text is written to the server logs. Audio and text are not written to disk. Logs only record size, duration of the call and status (pytest capturing logs, including the access log for a request to `/?token=X`).
- **03-C9**: On the deployed app, a preparation dictated in Spanish on Android Chrome and iOS Safari comes back as recognisable text. The chosen model is recorded in `docs/product/stack.md` (manual check with real voice notes).
- **03-C10**: A $5/month spending cap is set in the OpenAI and Anthropic consoles. The OpenAI key and the tokens exist only as Fly secrets. The README documents the caps and how to issue and revoke a token (manual check).
- **03-C11**: All user-facing text is in Spanish: labels, states and error messages, including the ones from spec 01 (frontend tests assert the Spanish text).

The chef uses an iPhone, so the phone checks in 03-C1 and 03-C9 are done first on a real iPhone. The Android Chrome checks stay pending until an Android device is available; meanwhile the app is checked on desktop Chrome, which uses the same engine and records the same format (`audio/webm;codecs=opus`).

## Edge cases
- A new recording replaces the previous one and clears its transcript. If a transcription for the old recording is still running, its result is ignored when it arrives.
- Pressing "Transcribe" twice quickly sends only one request.
- After a successful transcription, including the "No se ha detectado voz" case, "Transcribe" stays disabled until a new recording starts. After an error it stays enabled, so the chef can retry (03-C7).
- Silent or near-empty audio: the API may return empty text. Show "No se ha detectado voz" instead of an empty area.
- Cold start on Fly after idle: the first request can take tens of seconds. The client timeout must allow for it, and a slow response must not be shown as a failure before the timeout.
- The tab goes to the background while a transcription is running: the result is shown when the chef returns, or the error from 03-C7 if the request failed.
- iOS home-screen PWAs may not share `localStorage` with Safari, so the installed app can open without the token. The paste field in the block screen covers this (03-C2).
- Opening a link with a different token while one is stored: the new token replaces the old one.
- Tokens in the environment variable may have spaces around commas; they are trimmed. Empty entries are ignored.
- A valid token is revoked while the app is open: the next protected call returns 401, and the app clears the token and shows the block screen.
- The upload size cap must fit 2 minutes of audio in both formats; the exact value is set in the plan after measuring real recordings.
