# 01 – Plan

## Approach
Define a small `Recorder` interface (`start(): Promise<void>`, `stop(): Promise<Blob>`) and a browser implementation on top of `getUserMedia` + `MediaRecorder`. A `useRecorder` hook takes a `Recorder`, exposes `status` (`idle | recording | error`), the last recording as an object URL, and an error message. A `RecordScreen` component renders the button, the state, the error and an `<audio controls>` player. `App` renders `RecordScreen` for now (the Menu, Recipe sheet and Prices navigation comes later).

The mime type is picked at runtime with `MediaRecorder.isTypeSupported` from a short preference list (`audio/webm;codecs=opus`, `audio/mp4`, `audio/webm`), falling back to the browser default. Stopping releases the microphone tracks, and replacing a recording calls `URL.revokeObjectURL` on the old URL.

The frontend has no test runner yet, and 01-C4, 01-C5 and 01-C6 need unit tests. We add Vitest and Testing Library, which needs your approval first (see Risks).

## Alternatives considered
- Call `MediaRecorder` directly from the component: simpler, but breaks the `Recorder` architecture rule and makes 01-C4/01-C5 untestable without browser mocks.
- A third-party recording library: adds a dependency for about 40 lines of code, and hides the mime type handling we care about.
- Record as WAV through the Web Audio API: consistent format everywhere, but much larger files and more code. Not worth it before we know what the transcription API accepts.

## Files touched
- `frontend/src/recorder/Recorder.ts`: the interface and error types.
- `frontend/src/recorder/BrowserRecorder.ts`: `MediaRecorder` implementation.
- `frontend/src/recorder/useRecorder.ts`: hook.
- `frontend/src/screens/RecordScreen.tsx` and its CSS: UI.
- `frontend/src/App.tsx`: render `RecordScreen` instead of the health check.
- Tests next to each unit (`*.test.ts(x)`), using a fake `Recorder`.
- `frontend/package.json` and `frontend/vite.config.ts`: Vitest setup (needs approval).
- `Makefile` and `.github/workflows/ci.yml`: run frontend tests (needs approval, project configuration).

## Risks
- **New dev dependencies and config:** Vitest, `@testing-library/react`, `jsdom`, plus Makefile and CI changes. Per CLAUDE.md, we ask before adding them.
- **Removing the health check from `App`:** `getHealth` stays in `client.ts`, but the screen no longer shows it. Confirm this is acceptable.
- **iOS Safari quirks:** `audio/mp4` playback and permission prompts behave differently. Only verifiable on a real device, which needs HTTPS (spec 02) or a tunnel.
- **Format vs transcription:** the OpenAI API accepts both webm and mp4, but we confirm that in spec 03, not here.
