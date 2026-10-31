# 01 – Record audio

Status: implemented

## Why
Everything in the app starts with the cook speaking. Before transcribing anything, we need to know that the phone microphone works from the PWA and that a recording is good enough to be played back. This is the smallest slice that proves the capture side.

## Scope
- A screen with one record button: press to start, press again to stop.
- Play back the last recording on the same screen.
- Microphone access behind a `Recorder` interface, with a browser implementation (`MediaRecorder`).
- Clear feedback while recording and when the microphone is not available.

## Out of scope
- Sending audio to the backend (spec 03).
- Transcription, storage or a list of recordings.
- Navigation, the three final screens, or any styling beyond usable on a phone.
- Offline behaviour and native (Capacitor) recorder.

## Acceptance criteria
Each one must be checkable with a test or a manual check.

- **01-C1**: Pressing the button asks for microphone permission (first time) and starts recording; the button shows a recording state (label and visual change).
- **01-C2**: Pressing the button again stops the recording and shows a player with the captured audio.
- **01-C3**: The player plays back what was recorded (manual check on a real phone, Android Chrome and iOS Safari).
- **01-C4**: If permission is denied or no microphone exists, a readable message is shown and the app does not crash (unit test with a fake `Recorder`).
- **01-C5**: UI code depends only on the `Recorder` interface (`start()`, `stop()` returning a `Blob`), not on `MediaRecorder` directly (unit test using a fake implementation).
- **01-C6**: A new recording replaces the previous one; the old audio URL is released.

## Edge cases
- iOS Safari records `audio/mp4`, Chrome records `audio/webm`: pick the supported mime type at runtime.
- Microphone only works on HTTPS or localhost, so the phone check depends on spec 02; until then verify on desktop and via a local tunnel.
- Pressing stop immediately after start (empty or near-empty recording): if no audio was captured, show a message and keep the previous recording. A second press while the first is still starting is ignored.
- The tab goes to the background while recording: recording stops automatically and the audio captured so far is kept.
