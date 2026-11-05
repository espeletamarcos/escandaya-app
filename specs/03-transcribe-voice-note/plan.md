# 03 – Plan

## Approach

### Backend
1. **Settings.** A small settings module reads the environment once:
   - `ACCESS_TOKENS`: comma-separated list. Entries are trimmed and empty ones dropped. An empty or unset list means every protected route returns 401 (03-C3).
   - `OPENAI_API_KEY`: read by the OpenAI SDK. If it is missing, the transcription endpoint returns 503 and the rest of the app keeps running.
   - `TRANSCRIPTION_MODEL`: defaults to `gpt-4o-mini-transcribe` until the trial in 03-C9 picks a model.
2. **Token check.** A FastAPI dependency reads `Authorization: Bearer <token>` and compares it with each configured token using `secrets.compare_digest`. On failure it returns 401. A second router, `protected`, carries the dependency and is mounted under `/api`. `/api/health` stays on the public router (03-C3).
3. **`GET /api/session`.** Protected. It returns `204` when the token is valid, and the app calls it on open (03-C2).
4. **`Transcriber` interface.** A `Protocol` with `transcribe(audio: bytes, content_type: str) -> str`. `OpenAITranscriber` uses the `openai` SDK with `language="es"`, the configured model, a 60s timeout and SDK retries off. `FakeTranscriber` returns a fixed text or raises, for tests. The app gets the transcriber through a FastAPI dependency, so tests override it and never call OpenAI (03-C5).
5. **`POST /api/transcriptions`.** Protected. The body is the raw audio, with `Content-Type: audio/webm` or `audio/mp4` (codec parameters allowed). Responses:
   - `200 {"text": "..."}` on success.
   - `413` if the body is over 5 MB. The size is checked while the body is read, and `Content-Length` is checked first when present (03-C6).
   - `415` for any other content type.
   - `502` when OpenAI returns an error, and `504` on timeout. The response has a short generic `detail` with no key and no provider message (03-C7).
   - `503` when the OpenAI key is not configured.

   The bytes are passed to OpenAI in memory with a filename extension that matches the type (`.webm` / `.mp4`), because the API infers the format from it. Nothing is written to disk.
6. **Logs (03-C8).**
   - A logging filter on the `uvicorn.access` logger strips the query string from the logged path, so `/?token=X` is logged as `/`.
   - The transcription endpoint logs only size in bytes, content type, call duration and status.
   - Tests use `caplog` and assert that neither the token nor the fake transcript appears.

### Frontend
1. **Token storage.** `frontend/src/auth/token.ts` handles the token:
   - On load it reads `?token=` from the URL, saves it in `localStorage` (replacing any older one) and removes the token from the address bar with `history.replaceState`.
   - It exposes `getToken`, `setToken` and `clearToken`. Every `localStorage` access is wrapped in try/catch.
   - `parseTokenInput` accepts either a full link or a bare token, for the paste field (03-C1, 03-C2).
2. **`client.ts`.**
   - Adds the `Authorization` header to protected calls.
   - New functions: `checkSession()` and `transcribe(blob)`. `transcribe` sends the raw Blob with its own type.
   - A 90s timeout via `AbortController`.
   - Typed errors (`unauthorized`, `too-large`, `unsupported`, `failed`, `timeout`, `network`) so the UI can map them to messages.
   - On any 401, the token is cleared and the app returns to the block screen.
3. **App gate.** `App` shows a loading state while `checkSession()` runs, then shows either `AccessScreen` or `RecordScreen`. `AccessScreen` explains how to open the app from the private link and has a paste field. A valid input is stored and the session is checked again (03-C2).
4. **Transcription.** A `useTranscription` hook takes the client function as a parameter, so tests can pass a fake.
   - It exposes `status` (`idle | pending | done | error`), `text` and `error`.
   - It ignores a second call while one is pending.
   - Each request gets an id, and results for an outdated recording are dropped.
   - `RecordScreen` shows a "Transcribir" button after a recording exists. It is disabled while pending and once the status is `done` (empty text included), so each recording is transcribed at most once. It is enabled again after an `error`, for the retry, and when a new recording resets the hook to `idle`. The text appears under the player.
   - Empty text shows "No se ha detectado voz" (03-C4, 03-C7).
5. **2-minute limit (03-C6).**
   - `useRecorder` keeps an elapsed-time counter and stops by itself at 2:00, keeping the audio.
   - While recording, the screen shows `0:45 / 2:00`.
   - After an auto-stop it shows "Se ha alcanzado el límite de 2 minutos".
6. **Spanish UI (03-C11).** All labels, states and the spec 01 error messages are translated, and the existing tests are updated to assert the Spanish text. Code identifiers stay in English.

### Model trial and operations
- `scripts/transcribe_trial.py`, run with `uv run` from the backend environment. It sends local recordings (a folder given as argument, outside the repo) to each candidate model and prints the texts side by side. You choose the model by reading them, and the choice goes to `docs/product/stack.md` and the `TRANSCRIPTION_MODEL` Fly secret (03-C9).
- The first step of the trial measures the size of real 2:00 recordings on Android and iOS, to confirm or adjust the 5 MB cap.
- `scripts/smoke.sh` also checks that `GET /api/session` without a token returns 401.
- The README gets a section covering:
  - Generating a token with `python -c 'import secrets; print(secrets.token_urlsafe(32))'`.
  - Setting it with `fly secrets set ACCESS_TOKENS=...`.
  - Building the link `https://escandaya.fly.dev/?token=...`, and revoking a token by removing it from the list.
  - Setting `OPENAI_API_KEY` as a Fly secret.
  - The $5/month caps in the OpenAI and Anthropic consoles (03-C10).

Mapping to criteria:
- 03-C1, 03-C2: `token.ts`, the `App` gate and `AccessScreen`, with unit tests and a fake client. 03-C1 also needs a phone check, including the installed PWA.
- 03-C3: pytest on public vs protected routes, a list of tokens, and an empty list.
- 03-C4, 03-C7: `useTranscription` and `RecordScreen` tests with a fake client, including the button staying disabled after `done` and enabled after `error`; pytest with a failing `FakeTranscriber`.
- 03-C5: pytest for both content types with `FakeTranscriber`, checking language and model.
- 03-C6: `useRecorder` test with fake timers; pytest for the 413.
- 03-C8: pytest with `caplog`, including a request to `/?token=X` through the access-log filter.
- 03-C9, 03-C10: manual checks, recorded in `tasks.md`.
- 03-C11: frontend tests assert the Spanish strings.

## Alternatives considered
- **httpx instead of the `openai` SDK:** one less package, but we would write the multipart request, retries and error mapping ourselves. Discarded.
- **Multipart upload (`UploadFile`):** needs `python-multipart` and adds nothing while the request carries only the audio. Discarded.
- **Turning off uvicorn's access log and writing our own request log:** more code than a filter, and it changes the log format for every request. Discarded.
- **Token in a cookie instead of a header:** it would also protect the static frontend, but it needs CSRF care, and spec 03 keeps the frontend public. Discarded.
- **Token in a URL fragment (`#token=`):** the server would never see it, but the spec fixes `?token=` and the log filter covers that case. Discarded.
- **Middleware for the token check instead of a dependency:** it would need an allowlist for `/api/health` and the static paths. A protected router is explicit and easier to test. Discarded.
- **Model trial by switching the Fly secret:** no script, but comparing models on the same audio would be slow and hard. Discarded.

## Files touched
- `backend/pyproject.toml`, `backend/uv.lock`: add `openai` (approved in this plan).
- `backend/src/backend/main.py`: public and protected routers, the access-log filter, wiring.
- `backend/src/backend/settings.py`: environment variables.
- `backend/src/backend/auth.py`: token dependency.
- `backend/src/backend/transcription.py`: `Transcriber`, `OpenAITranscriber`, the endpoint.
- `backend/tests/`: `test_auth.py`, `test_transcription.py`, `test_logging.py`, plus a shared `FakeTranscriber` in `conftest.py`.
- `frontend/src/api/client.ts`: auth header, `checkSession`, `transcribe`, timeout, typed errors.
- `frontend/src/auth/token.ts` and tests.
- `frontend/src/screens/AccessScreen.tsx` and tests; `RecordScreen.tsx` and tests (Transcribe button, timer, Spanish text).
- `frontend/src/transcription/useTranscription.ts` and tests.
- `frontend/src/recorder/useRecorder.ts` and tests: elapsed time, auto-stop, Spanish messages.
- `frontend/src/App.tsx`: session gate.
- `scripts/transcribe_trial.py`, `scripts/smoke.sh`.
- `README.MD`: tokens, secrets, spending caps.
- `docs/product/stack.md`: chosen model, then tick the open decision for the transcription model (Claude stays open until spec 04).
- `specs/README.md`: status of spec 03.

## Risks
- **New dependency:** `openai` (approved here). No change to CI is needed, because tests never call the real API.
- **iOS `audio/mp4` and the API:** the format is accepted on paper, but iOS sometimes writes MP4 variants the API rejects. The phone check in 03-C9 is where this shows up. If it fails, update the spec before changing the recording format.
  - Result: the iPhone tested on 2026-11-05 recorded `audio/webm`, so the MP4 path is still untested on a real phone. Only older iOS versions use it, and pytest covers it on the backend.
- **iOS home-screen PWA storage:** the installed app may not see the token saved in Safari. The paste field covers it, but the chef must have the link at hand once.
- **Token in browser history:** `replaceState` removes it from the address bar, but the first visit may still be in the browser history. This is acceptable for a private phone, and documented in the README.
- **Header leaks:** the token travels in a header that uvicorn does not log, but any future middleware that logs headers would leak it. A test that asserts the token is not in the logs guards against this.
- **Cold start plus slow transcription** can exceed 90s in rare cases. In that case the chef sees the timeout message and retries.
- **Changing the spec 01 tests** to the Spanish strings touches tests that already pass. The change is mechanical, but it is reviewed as part of 03-C11.
- **Cost:** each transcription spends money. The $5 caps, the 2-minute limit and the one-transcription-per-recording rule bound it until spec 08 adds per-token daily caps.
