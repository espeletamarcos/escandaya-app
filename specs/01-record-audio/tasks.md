# 01 – Tasks

- [x] Get approval, then add Vitest, Testing Library and jsdom to the frontend, with a `test` script, and run frontend tests in `make test` and CI (all criteria, enabler)
- [x] Define the `Recorder` interface and error types in `recorder/Recorder.ts`, with a fake implementation for tests (01-C5)
- [x] Write tests, then `useRecorder`: idle to recording to idle, exposes the last recording URL (01-C1, 01-C2)
- [x] Test and handle errors: permission denied and no microphone give a readable message and return to idle (01-C4)
- [x] Test and implement replacing a recording, revoking the old object URL (01-C6)
- [x] Implement `BrowserRecorder` with runtime mime type selection, releasing tracks on stop (01-C1, 01-C2)
- [x] Build `RecordScreen`: record button with a recording state, error message and `<audio controls>` player; render it from `App` (01-C1, 01-C2, 01-C4)
- [x] Manual check on desktop Chrome, and on Android Chrome and iOS Safari through a tunnel or after spec 02; note results in this file (01-C3)
  - Desktop Chrome: record, stop, playback, re-record and denied permission all work.
  - Android Chrome and iOS Safari: record, stop and playback work over HTTPS on both real phones (2026-10-30, checked through spec 02).
- [x] Handle stop right after start and tab in background (edge cases)
