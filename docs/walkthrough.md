# Escandaya walkthrough

A summary of how the whole app works, one chapter at a time, written for someone new to Python.
Each chapter ends with check questions and their answers.

Chapters: 0 The map · 1 Python basics · 2 Backend startup · 3 Dependency injection · 4 Opening the app · 5 Transcription · 6 Drafts · 7 Tests · 8 Dev, build, deploy · 9 Recap

Covered so far: chapters 0–5 (2026-11-09/10). Chapters 6–9 aren't written yet.

---

## 0. The map

**Request path:** phone (React PWA) → Fly.io (HTTPS, forwards to port 8080) → one Docker container → uvicorn (web server) → FastAPI app (`backend/src/backend/main.py`) → OpenAI.

**One URL, two kinds of requests:**
- Paths that don't start with `/api` (like `/` or `/assets/index-abc.js`) are files from `frontend/dist`, the built React app. FastAPI's catch-all route sends them, with no logic involved.
- Paths under `/api/...` are the real backend logic. The React code calls them with `fetch` once it's running on the phone.

**Routes:**
- `GET /api/health`: public.
- `GET /api/session`: checks the token.
- `POST /api/transcriptions`: audio → text.
- `POST /api/drafts`: text → recipe sheet.

There is no database yet. That comes in spec 05.

**Where things live:**
- `backend/src/backend/`: the Python app.
  - `main.py`: wiring.
  - `auth.py`: token check.
  - `settings.py`: environment variables.
  - `transcription.py`, `structuring.py`.
  - `sheets.py`: recipe sheet models.
  - `logs.py`.
- `backend/tests/`: pytest, with fakes in `conftest.py`.
- `frontend/src/`: React. **`api/client.ts` is the only file that talks to the backend.**
- `Dockerfile`, `fly.toml`: packaging and deploy.
- `Makefile`: shortcuts.

**Two design rules:**
- The OpenAI key lives only in the backend.
- The LLM only returns data. Our code validates it and decides.

### Questions

1. In production, which program sends the React JS files to the phone?
   **FastAPI**, running under uvicorn. The catch-all route at the bottom of `main.py` returns files from `frontend/dist`. Fly only handles HTTPS and forwards the request: it's the doorman, not the one handing out the files.
2. Why does audio go phone → backend → OpenAI instead of straight to OpenAI?
   Anything sent to the phone can be read there, so a key in the frontend would be public. The route through the backend also lets you control limits, timeouts and what gets logged.
3. Where is the code that decides whether a token is valid?
   `backend/src/backend/auth.py`, in `require_token`. The frontend's `auth/token.ts` only *stores* the token. Only the backend knows the real tokens (`ACCESS_TOKENS`).

---

## 1. Python basics, compared with TypeScript

| Python | TypeScript / JS |
|---|---|
| indentation | `{ }` |
| `def f(x: str) -> None:` | `function f(x: string): void` |
| `None`, `is None` | `null`, `=== null` |
| `value or None` | `value \|\| null` |
| `str \| None`, `list[str]`, `tuple[str, ...]`, `dict[str, str]` | `string \| null`, `string[]`, `readonly string[]`, `Record<string, string>` |
| `Literal["g", "kg"]` | `"g" \| "kg"` |
| `class X:` + `__init__(self, ...)` | `class X { constructor(...) }` |
| `self` | `this` |
| `X(...)` | `new X(...)` |
| `raise` / `try` / `except X:` / `finally` | `throw` / `try` / `catch` with an `instanceof` check / `finally` |
| `lambda: ...` | `() => ...` |
| `f"items.{i}"` | `` `items.${i}` `` |
| `X if cond else Y` | `cond ? X : Y` |
| `for i, item in enumerate(xs):` | `xs.forEach((item, i) => ...)` |
| `_name` | "private" by convention only |

**Key ideas:**
- **Type hints.** Python ignores them when running. FastAPI and Pydantic are the exception: they *read* them to validate data.
- **Modules.** Each `.py` file is a module. Its top-level code runs **once**, on first import.
- **`@dataclass(frozen=True)`.** A read-only record with a generated constructor (`Settings`).
- **Decorators (`@...`).** They wrap or register a function:
  - `@lru_cache` remembers the result.
  - `@router.post("/drafts")` registers a route.
- **`Protocol`.** An interface with structural typing, like TS. A class fits if it has the right methods. It never declares `implements`, so `FakeTranscriber` and `OpenAITranscriber` both fit `Transcriber`.
- **`except` order.** `except` blocks are tried in order, so catch the specific error before the general one (`APITimeoutError` before `OpenAIError`).
- **`raise X from None`.** It hides the original exception, so provider messages (request ids, key details) never leak.
- **`async` / `await`.** Like JS, but many Python libraries *block*, including the OpenAI client. A blocking call inside `async` freezes the whole server. That's why the code uses `await run_in_threadpool(fn, ...)`.
- **Pydantic `BaseModel`.** A type that is **checked at runtime** (TS type + Zod). Bad data raises `ValidationError`.
- **`Annotated[T, extra]`.** The type is `T`, plus extra info for whoever reads it:
  - `Annotated[float, Field(gt=0)]` gives Pydantic a rule to enforce.
  - `Annotated[str, Depends(audio_type)]` tells FastAPI to call `audio_type` to get the value.

### Questions

1. `get_settings()` has `@lru_cache`. With 50 requests, how many times is the environment read? How do tests get different settings?
   **Once.** Tests never call the real `get_settings`: `conftest.py` replaces it with `app.dependency_overrides[get_settings] = lambda: make_settings(tokens)`, so the cache is never involved.
2. `FakeTranscriber` never mentions `Transcriber`. Why is it accepted?
   Structural typing. It has a `transcribe(self, audio: bytes, content_type: str) -> str` method, which is the shape the `Protocol` asks for. No `implements` is needed.
3. What can a Pydantic model do that a TS type can't, and why does it matter for OpenAI's output?
   It **validates at runtime**. An LLM can return negative quantities, unknown units or broken JSON. Pydantic catches that, and the endpoint answers 502 instead of passing bad data to the chef.

---

## 2. Backend startup (`uvicorn backend.main:app`)

uvicorn imports `backend.main` and serves its `app` variable. The import does this, in order:

1. **Imports run the other modules.** `transcription.py` and `structuring.py` each create `router = APIRouter()`, and their `@router.post(...)` decorators add one route each. These routers aren't connected to anything yet.
2. **`configure_logging()`** (`logs.py`):
   - Strips `?token=...` from uvicorn's access log.
   - Makes the app's own `logger.info` lines print.
3. **Two routers:**
   - `api = APIRouter(prefix="/api")` is public.
   - `protected = APIRouter(prefix="/api", dependencies=[Depends(require_token)])` runs the token check before every route it holds.
4. **`protected.include_router(...)`** copies the transcription and structuring routes into the protected router. `main.py` decides about auth; the feature files don't know about it.

   | Route | Token? |
   |---|---|
   | `GET /api/health` | no |
   | `GET /api/session` (empty body, answers 204 if the token passed) | yes |
   | `POST /api/transcriptions` | yes |
   | `POST /api/drafts` | yes |

5. **`default_static_dir()`** finds the built frontend:
   - It uses `FRONTEND_DIST` (set in Docker), or else `frontend/dist` in the repo.
   - It returns `None` if the folder doesn't exist. That's normal in dev, where Vite serves the frontend.
6. **`create_app(static_dir)`** builds the `FastAPI()` app, adds both routers, then the **catch-all** `/{path:path}`. It's a function so tests can build a fresh app each time.
   - Routes are matched in the order they were added, so the API routes win.
   - `api` or `api/...` → **404**, so a typo never gets `index.html`.
   - A real file inside `dist` → that file. `resolve()` and `is_relative_to(root)` block `../` tricks.
   - A missing path with an extension → 404. Anything else → `index.html`, so React can handle it.
7. **Settings are read lazily.** Nothing at startup calls `get_settings()`. The environment is read at the first request that needs it, then cached.
   - `load_settings` turns `ACCESS_TOKENS="abc, def,,"` into `("abc", "def")`.
   - It takes `env` as a parameter (default `os.environ`), so tests can pass a plain dict.

### Questions

1. You add `@router.get("/units")` in `structuring.py`. What URL does it get, does it need a token, and which file decided that?
   **`/api/units`, and yes, it needs a token.** `main.py` decided it with `protected.include_router(structuring.router)`. The token requirement comes from **which router a route is attached to**, not from `settings.py`. `settings.py` only holds the *values*: which tokens are valid.
   Think of a building with two doors. `api` is an open door. `protected` is a door with a guard (`require_token`). `structuring.py` builds a room (`router`) without knowing where it goes. `main.py` attaches that room behind the guarded door, so every route in it, now and in the future, gets the guard.
2. A browser requests `GET /api/sesion` (typo). What catches it, and what comes back? What would happen without the `startswith("api/")` check?
   FastAPI tries the routes in order. `/api/health`, `/api/session`, `/api/transcriptions` and `/api/drafts` don't match. The catch-all `/{path:path}` matches *anything*, so it gets the request with `path = "api/sesion"`. Its first check, `path.startswith("api/")`, sends back **404**.
   Without that check: `dist/api/sesion` isn't a file, and `"api/sesion"` has no extension, so it would return **`index.html` with 200**. The frontend's `fetch` would see a success, then fail trying to read the HTML as JSON, which is a confusing bug. The check turns it into a clear 404.
   (This only applies when the built frontend exists. In dev without `dist`, the catch-all isn't added, and FastAPI's own 404 answers.)
3. With no `ACCESS_TOKENS` set, does `GET /api/health` work? And `GET /api/session` with a token?
   `/api/health` works: it's on the public `api` router.
   `/api/session` does **not** work: it answers **401**. With no `ACCESS_TOKENS`, `settings.access_tokens` is `()`, an empty tuple. The loop in `require_token` runs zero times, `valid` stays `False`, and every token is rejected. A missing setting locks everyone out instead of letting everyone in. This is called "fail closed", and it's the safe default.
4. In production, what does `GET /recipes` return?
   **`index.html` with 200, not a 404.** The catch-all gets the request, and `"recipes"` doesn't start with `api`, isn't a file in `dist`, and has no extension, so it reaches the last line.
   The rule: a path **without** `/api` is treated as *a page of the app*. The server always hands back the React app, and React decides what to show for that URL. This is the "single-page app fallback". Without it, refreshing or bookmarking any page other than `/` would give a 404.

   | Request | Result |
   |---|---|
   | `/api/sesion` | 404: an unknown API path |
   | `/assets/index-abc.js` | that file |
   | `/missing.png` | 404: a missing file (it has an extension) |
   | `/recipes` | `index.html`: a page, which React handles |

---

## 3. Dependency injection (`Depends`)

**`Depends(fn)`** means: "before running this endpoint, call `fn`. If it raises, stop. If it returns, give me the result."
- Router-level dependencies (`dependencies=[Depends(require_token)]`) only act as a gate. Their result is thrown away.
- Dependencies can have their own dependencies. `require_token` needs `get_settings` (another `Depends`) and the `Authorization` header (`Header()`).
- `Header()` reads a request header named after the parameter, with `_` turned into `-`. So `authorization` reads `Authorization`, and `content_type` reads `Content-Type`.

**The order for a request, before your function's body runs:**

0. Is the body broken JSON? Then 422 right away. This happens even before the token check, because FastAPI reads the body first. (Only for endpoints with a Pydantic body, like `/api/drafts`.)
1. Router dependencies: `require_token` (and `get_settings`) → 401.
2. Parameter dependencies, **in the order they are declared**:
   - `/api/transcriptions`: `audio_type` → 415, then `get_transcriber` → 503.
   - `/api/drafts`: `get_structurer` → 503.
3. Body validation against the Pydantic model (`DraftRequest`: trimmed text, 1–5000 chars) → 422.
4. The endpoint body runs.

The first step that raises decides the answer. Checked by running the real app:

| Request | Status |
|---|---|
| drafts, no token, broken JSON | 422 |
| drafts, no token, `{"text": ""}` | 401 |
| drafts, token, no OpenAI key, `{"text": ""}` | 503 (503 wins over 422) |
| transcriptions, token, no key, `text/plain` | 415 (declared before the transcriber) |
| transcriptions, token, no key, `audio/webm` | 503 |

**Why use dependencies at all?**
- Shared checks are written once: the token check lives on the router.
- Endpoints stay short.
- **Tests can swap them.** `app.dependency_overrides[get_settings] = lambda: make_settings(...)` and `app.dependency_overrides[get_transcriber] = lambda: fake` replace the real function. The endpoint never knows it's talking to a fake, so tests never need real environment variables or OpenAI.

**`get_transcriber` / `get_structurer`:**
- They read the settings, and with no `OPENAI_API_KEY` they raise **503** ("not configured").
- Otherwise they return a cached client, one per key and model, through `@lru_cache`.
- The endpoint only asks for "a `Transcriber`". It doesn't care whether that's the real one or a fake.

### Questions

1. In `create_transcription`, someone swaps the order of the parameters so that `transcriber` comes before `content_type`. On a server without an OpenAI key, what does a request with `Content-Type: text/plain` return now?
   **503.** `get_transcriber` now runs first and raises before `audio_type` ever gets to answer 415.
2. Why does `require_token` never appear in the parameter list of `create_draft`, even though it runs on every call?
   Because it's attached to the **`protected` router** in `main.py` (`dependencies=[Depends(require_token)]`). `protected.include_router(structuring.router)` gives that gate to every route in `structuring.router`. `create_draft` only lists what it *uses*. The gate's result (`None`) is thrown away.
3. In a test, `make_client(tokens=("t",), structurer=FakeStructurer(raw=...))`. Which two dependencies are overridden, and what does each one return instead of the real thing?
   - **`get_settings`** returns `make_settings(("t",))`: a `Settings` whose only valid token is `"t"`, with **no OpenAI key**. (It's the settings that are overridden, not "the token". `require_token` itself is the real function, reading fake settings.)
   - **`get_structurer`** returns the `FakeStructurer`.
   - Bonus, why no 503: the 503 lives *inside the real* `get_structurer`. That function is replaced, so the key check never runs.
   - `make_client` is a pytest **fixture** in `conftest.py`. A test asks for it by name in its parameters, and pytest passes in the `factory` function. Each call to it builds a fresh app with its own overrides. Chapter 7 covers this.

---

## 4. Trace ①: opening the app

The chef opens the private link `https://escandaya.fly.dev/?token=abc`.

1. **Server:** `/` goes to the catch-all, which returns `index.html`, and then the JS and CSS files. No Python logic runs yet.
2. **`main.tsx`** runs `captureTokenFromUrl()` *before* the first render (`auth/token.ts`):
   - Store `abc` with `setToken`: in localStorage, or in memory if storage is blocked.
   - Remove `?token=` from the address bar with `history.replaceState`, so it doesn't stay in history or show up in screenshots.
   Then React renders `<App />`.
3. **`App.tsx`, the gate.** State starts as `{ kind: "checking" }` → `CheckingScreen` ("Comprobando acceso…"). A `useEffect` runs `runCheck(false)` after the first render.
4. **`runCheck`** takes `id = ++latestCheck.current` and calls `session.checkSession()`.
5. **`client.checkSession`:**
   - With no token stored, it returns `false` without making a request.
   - Otherwise it calls `protectedRequest("/session", GET, 10 s)`.
6. **`protectedRequest`**, shared by every protected call:
   - It adds `Authorization: Bearer abc`.
   - An `AbortController` and a timer cancel `fetch` after the timeout.
   - If `fetch` throws, that becomes `ApiError("timeout")` or `ApiError("network")`.
   - A 401 runs `handleUnauthorized()`: it clears the token and notifies the listeners.
   - Any other non-2xx status becomes `ApiError(errorForStatus(status))`.
7. **Backend `GET /api/session`.** `require_token` runs:
   - `"Bearer abc".partition(" ")` gives `("Bearer", " ", "abc")`. A wrong scheme or an empty token → 401.
   - It compares against **every** configured token with `secrets.compare_digest`, with no early exit. That way the response time doesn't reveal how close a guess was (a timing attack).
   - If it passes, `session()` returns **204**.
8. **Back in the frontend:**
   - `checkSession` returns `true` on a 2xx, or `false` on a 401.
   - Any other failure (no signal, 5xx) **throws**, so no signal is never mistaken for a wrong token.
9. **`runCheck`** only applies the result if `id === latestCheck.current`, so an older, slower check can't overwrite a newer one. React's StrictMode runs effects twice in dev.
   - `true` → `{ kind: "unlocked" }` → `RecordScreen`.
   - `false` → `locked` → `AccessScreen`.
   - An error → `unavailable` → `UnavailableScreen`, whose "Reintentar" button calls `retry()`.
10. **The AccessScreen path:**
    - The chef pastes the link or code, and `parseTokenInput` extracts the token. If it can't, the screen shows "No es un enlace ni un código válido".
    - `onToken` → `handleToken`: `setToken`, the gate becomes `locked({ checking: true })` (the button shows "Comprobando…"), then `runCheck(true)`.
    - If the backend still rejects the token, the screen shows "Ese enlace no es válido".
11. **Later 401s.** `App` subscribes with `session.onUnauthorized(() => setGate(locked()))`. Any 401 from any request, for example a token revoked while the app is open, sends the chef back to `AccessScreen`.

**React concepts used:**
- A **component** is a function that returns JSX.
- **Props** are its arguments.
- **`useState`** is a value that triggers a re-render when it changes.
- **`useEffect(fn, [deps])`** runs `fn` after a render, whenever a dep changes. The function it returns is the cleanup (here it unsubscribes).
- **`useRef`** is a value that survives re-renders *without* causing one (`latestCheck`).
- **`useCallback`** keeps the same function between renders unless its deps change.
- **`Gate`** is a *discriminated union*: `switch (gate.kind)` picks the screen, and TypeScript checks every case.

**Testability.** `App` takes `session` and `recorder` as props, with the real ones as defaults. Tests pass fakes. It's the same idea as `dependency_overrides`.

### Questions

1. The chef opens the app on the metro with no signal, and a valid token is stored. Which screen do they see, and why not `AccessScreen`?
   **`UnavailableScreen`**: "No se ha podido comprobar el acceso" and a "Reintentar" button.
   - `fetch` gets no response at all. `protectedRequest` turns that into `ApiError("network")`, or `ApiError("timeout")` after 10 s.
   - `checkSession` only turns `"unauthorized"` into `false`. It **re-throws** every other error.
   - `runCheck`'s `catch` sets `{ kind: "unavailable" }`.
   - The token is kept, because no signal says nothing about whether the token is valid.
   - ("No es un enlace ni un código válido" belongs to `AccessScreen`. It only appears when a *pasted* text can't be read as a token.)
2. Why does `captureTokenFromUrl()` run in `main.tsx` before `render`, and not later inside `App`?
   It's about **timing**. `App`'s first `useEffect` immediately runs `checkSession()`, which calls `getToken()`.
   - If the token weren't stored yet, `getToken()` would return `null`, `checkSession` would return `false`, and a chef with a perfectly good link would get `AccessScreen`.
   - Running it before `render` guarantees the token is stored before any check happens.
   - It also removes the token from the address bar as early as possible.
   (See the comment in `main.tsx`: "so the token is stored and gone from the address bar before the app checks its session.")
3. The token is revoked on Fly while the chef is on `RecordScreen`, and they press "Transcribir". Trace what happens, file by file, until they see `AccessScreen`.
   1. `RecordScreen.tsx`: the button's `onClick` calls `transcription.transcribe(audio)`.
   2. `useTranscription.ts`: it calls the injected `transcribeFn`, which is `client.transcribe`.
   3. `client.ts`: `transcribe` calls `protectedRequest("/transcriptions", ...)`, and `fetch` sends `Authorization: Bearer <old token>`.
   4. Backend: `require_token` runs. The token is no longer in `ACCESS_TOKENS`, so it answers **401**. (`fly secrets set` restarts the machine, so `get_settings` reads the new list.)
   5. `client.ts`: `protectedRequest` sees the 401 and calls `handleUnauthorized()`. That runs `clearToken()` (`auth/token.ts`), then calls every listener.
   6. `App.tsx`: its listener (`session.onUnauthorized(() => setGate(locked()))`) runs, so the gate becomes `locked`.
   7. `App` re-renders. `switch (gate.kind)` now picks **`AccessScreen`**, which replaces `RecordScreen`.
   (`protectedRequest` also throws `ApiError("unauthorized")` back to `useTranscription`, but `RecordScreen` is already gone, so that error message is never seen.)
   The key idea: **the client and `App` are connected by a listener** that `App` registered when it started. Nothing "redirects". `App` just changes its state and draws a different screen.

---

## 5. Trace ②: record, then transcribe (`POST /api/transcriptions`)

### Recording (frontend only, no backend involved)

1. **`RecordScreen`**: the "Grabar" button calls `onRecordClick`.
   - Starting a new recording first calls `transcription.reset()`, because the old transcript no longer applies.
   - Then it calls `toggle()` from `useRecorder`.
2. **`useRecorder.run`**:
   - A `busy` ref ignores double taps.
   - If idle, it clears the notice, sets the timer to 0, awaits `recorder.start()`, then sets `status = "recording"`.
   - Errors become Spanish messages (permission denied, no microphone, …).
3. **`BrowserRecorder.start`**:
   - It checks browser support, then opens the microphone with `getUserMedia({ audio: true })`.
   - Browser errors become `RecorderError` codes.
   - It picks the first supported format: `audio/webm;codecs=opus` (Chrome, recent Safari), `audio/mp4` (older iOS) or `audio/webm`.
   - It starts a `MediaRecorder` that collects the audio in chunks.
4. **While recording**, two effects run only while `status === "recording"`:
   - A 250 ms interval computes `elapsed` from the clock, so it never drifts.
   - A 120 s timeout stops the recording itself and shows "Se ha alcanzado el límite de 2 minutos".
   - If the page goes to the background (`visibilitychange`), it stops and keeps what was recorded.
   - Each effect's cleanup clears its timers when the status changes.
5. **"Parar"** calls `stop()`, then `recorder.stop()`, which resolves in `onstop`:
   - It releases the microphone (stops the tracks).
   - It builds one `Blob` from the chunks, with its format. An empty one becomes an error.
   - `URL.createObjectURL(blob)` feeds the `<audio controls>` player. The previous URL is revoked, to free memory.

### Transcribing

6. **`RecordScreen`** shows "Transcribir" once there is audio and no recording is running.
   - The button is disabled while the request is `pending`, and also once it's `done`.
   - Each recording is transcribed at most once. A retry is allowed after an error.
7. **`useTranscription.transcribe`**:
   - A `pending` guard stops double sends. Each request gets `id = ++requestId.current`.
   - It sets `status = "pending"` (shown as "Transcribiendo…") and awaits `transcribeFn(audio)`.
   - **A result whose id is out of date is ignored.** `reset()` increments `requestId`, so a late answer for an old recording is dropped.
8. **`client.transcribe`** calls `protectedRequest("POST /transcriptions")`:
   - The body is **the raw `Blob`**: not JSON, not a form.
   - It sends `Content-Type: audio.type` (for example `audio/webm;codecs=opus`) and has a **90 s** timeout.
   - It checks that the response looks like `{ text: string }`. Otherwise it throws, which becomes `ApiError("failed")`.

### Backend, in order

| Step | Code | Fails with |
|---|---|---|
| 1 | `require_token` (router) | 401 |
| 2 | `audio_type`: `"audio/webm;codecs=opus"` → `"audio/webm"`, must be webm or mp4 | 415 (logged, without the sent type) |
| 3 | `get_transcriber`: needs `OPENAI_API_KEY` | 503 |
| 4 | `read_audio`: rejects a declared `Content-Length` > 5 MB before reading, then streams chunks and stops as soon as the total passes 5 MB (the header can be missing or lie) | 413 (logged) |
| 5 | `run_in_threadpool(transcriber.transcribe, audio, content_type)` | |
| 6 | `OpenAITranscriber.transcribe`: OpenAI with filename `voice-note.webm`/`.mp4` (the API infers the format from it), `language="es"`, 60 s timeout, no retries. Its errors are translated into `TranscriptionTimeout` / `TranscriptionError` | |
| 7 | The endpoint maps `TranscriptionTimeout` → **504** and `TranscriptionError` → **502**, `from None` | 502 / 504 |
| 8 | `finally`: **one** log line, `transcription status= bytes= type= duration_ms=`. Never the audio, the text or the headers | |
| 9 | `return TranscriptionResponse(text=text)`: FastAPI turns the Pydantic model into JSON `{"text": "..."}` with 200 | |

**Why `run_in_threadpool`?**
- `async` code in Python runs on **one** thread, the *event loop*, which takes turns between requests whenever one `await`s.
- The OpenAI client **blocks**: it holds the thread until OpenAI answers. Called directly, a 20 s transcription would freeze *every* other request for those 20 s, including `/api/health`.
- `run_in_threadpool` runs it on a separate worker thread, and `await` frees the event loop meanwhile.

**Why no retries, and why 60 s?** The frontend gives up at 90 s. One retry could take the backend past that. With 60 s, the backend's clear 504 arrives before the frontend's own timeout.

### Back on the screen

- `client.ts` turns the status into an `ApiErrorKind`: 413 → `too-large`, 415 → `unsupported`, 504 → `timeout`, 401 → `unauthorized`, anything else (502, 503) → `failed`.
- A missing response is `network`. Aborted after 90 s, it's `timeout`.
- `useTranscription`'s `errorMessage` turns the kind into a Spanish message.
- On success, `RecordScreen` shows the text, or "No se ha detectado voz" if it's blank.

### Questions

1. With the key configured, the phone sends a 6 MB `audio/mp4` recording with a correct `Content-Length`. What status comes back, at which line, and does the backend read the audio?
   **413, and no, the audio isn't read.**
   - The dependencies pass first: the token is fine, `audio/mp4` is supported, and the key is set.
   - Then the **first `if` in `read_audio`** sees `Content-Length` > 5 MB and raises before the `async for` loop reads a single chunk.
   - The endpoint logs `status=413` and re-raises.
2. Without `run_in_threadpool`, what would a second chef notice while the first chef's transcription waits 20 s for OpenAI?
   Their requests would **hang**. The one event loop thread is stuck inside the blocking OpenAI call, so no other request is served until it returns.
   - Opening the app would sit on "Comprobando acceso…" until the 10 s session timeout, then show `UnavailableScreen`.
   - Fly's health check on `/api/health` could time out too.
   - With `run_in_threadpool`, the wait happens on a worker thread and everyone else is served normally.
3. The chef presses "Transcribir", and before the answer arrives presses "Grabar" again. What stops the old transcript from appearing under the new recording?
   **The request id.**
   - "Grabar" runs `onRecordClick`, which calls `transcription.reset()`. That increments `requestId.current`, from 1 to 2, sets `pending` back to `false` and clears the text.
   - When the old answer arrives, `transcribe` compares the `id` it captured at the start (1) with the current one (2). They differ, so it `return`s without calling `setText`.
   - The old transcript is silently dropped, and the new recording can be transcribed.
