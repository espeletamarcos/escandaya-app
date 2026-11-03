# 03 – Tasks

## Backend
- [x] Add the `openai` package to the backend with `uv add openai` and check that `make test` and `make lint` still pass (all criteria, enabler; approved in the plan)
- [x] Write tests, then add `settings.py`: read `ACCESS_TOKENS` (trimmed, empty entries dropped), `OPENAI_API_KEY` and `TRANSCRIPTION_MODEL` (default `gpt-4o-mini-transcribe`) (03-C3, 03-C5)
- [x] Write tests, then add the token dependency in `auth.py` and a protected router under `/api`, with `GET /api/session` returning 204. `/api/health` and the static frontend stay public. An empty or unset list rejects everything (03-C3)
- [x] Define the `Transcriber` protocol and a `FakeTranscriber` in `conftest.py`, and wire the transcriber into the app as an overridable dependency (03-C5)
- [x] Write tests, then add `POST /api/transcriptions`: accept `audio/webm` and `audio/mp4` (codec parameters allowed) and return `{"text": ...}`. Return 415 for other types and 503 when the key is missing (03-C5)
- [x] Write tests, then enforce the 5 MB cap with 413, checking `Content-Length` first and then the bytes as they are read (03-C6)
- [x] Write tests, then map transcriber failures to 502 and timeouts to 504, with a generic `detail` that has no key and no provider message (03-C7)
- [x] Implement `OpenAITranscriber`: `language="es"`, the configured model, a 60s timeout, SDK retries off, and an in-memory file whose extension matches the type (03-C5)
- [x] Write tests with `caplog`, then add the `uvicorn.access` filter that strips query strings, and the endpoint log line (size, type, duration, status). Assert that the token and the transcript never appear in the logs (03-C8)

## Frontend
- [x] Write tests, then add `auth/token.ts`:
  - Read `?token=` from the URL, store it in `localStorage` (replacing any older one) and remove it from the address bar.
  - Add `getToken`, `setToken` and `clearToken`, all safe if storage is unavailable.
  - Add `parseTokenInput` for a pasted link or bare token.

  (03-C1)
- [x] Write tests, then extend `client.ts`:
  - Send the `Authorization` header on protected calls.
  - Add `checkSession()` and `transcribe(blob)`, which sends the raw Blob.
  - Abort after 90s.
  - Add typed errors: `unauthorized`, `too-large`, `unsupported`, `failed`, `timeout`, `network`.
  - Clear the token on any 401.

  (03-C2, 03-C4, 03-C7)
- [ ] Write tests, then add `AccessScreen` and the session gate in `App`: show a loading state while checking, the block screen without a valid token, and unlock after pasting a valid link or token (03-C2)
- [ ] Write tests, then add `useTranscription`: pending, done and error states, ignore a second call while pending, and drop results for an outdated recording (03-C4, 03-C7, edge cases)
- [ ] Write tests, then add the "Transcribir" button and the read-only text to `RecordScreen`:
  - Disable the button while pending.
  - Show readable error messages with retry.
  - Show "No se ha detectado voz" for empty text.
  - Clear the text when a new recording starts.

  (03-C4, 03-C7)
- [ ] Write tests with fake timers, then add the elapsed-time counter to `useRecorder` and the `0:45 / 2:00` display. At 2:00, stop by itself, keep the audio and show "Se ha alcanzado el límite de 2 minutos" (03-C6)
- [ ] Translate all user-facing text, including the spec 01 messages, to Spanish, and update the existing tests to assert the Spanish strings (03-C11)

## Operations
- [ ] Extend `scripts/smoke.sh` to also check that `GET /api/session` without a token returns 401 (03-C3)
- [ ] Write `scripts/transcribe_trial.py`: send every recording in a given folder to each candidate model and print the texts side by side (03-C9)
- [ ] Set the $5/month spending caps in the OpenAI and Anthropic consoles, and set `OPENAI_API_KEY` and `ACCESS_TOKENS` as Fly secrets (03-C10, manual)
- [ ] Document in `README.MD`:
  - Generating, setting, linking and revoking tokens.
  - The `OPENAI_API_KEY` secret.
  - The spending caps.
  - That the first visit with the token may stay in the browser history.

  (03-C10)

## Manual checks
- [ ] Record real 2:00 notes on Android and iOS, measure their size, and confirm or adjust the 5 MB cap; note results here (03-C6)
- [ ] Run the model trial on real kitchen recordings, choose the model, set `TRANSCRIPTION_MODEL` on Fly and record the choice in `docs/product/stack.md`; note results here (03-C9)
- [ ] On the deployed app, on Android Chrome and iOS Safari:
  - Open from the private link and check that the token disappears from the address bar.
  - Reopen without it.
  - Check the installed PWA, using the paste field if it is blocked.
  - Check that a wrong token shows the block screen.

  Note results here (03-C1, 03-C2)
- [ ] On the deployed app, on both phones: dictate a real preparation in Spanish, transcribe it, and check that the text is recognisable. Also check the 2:00 auto-stop, and the error message with retry (for example, in airplane mode). Note results here (03-C4, 03-C6, 03-C7, 03-C9)
- [ ] Check `fly logs` after opening the private link and transcribing: no token and no transcript text in the logs (03-C8)
- [ ] Update the status of spec 03 in `specs/README.md` as it moves to `in progress` and `implemented`
