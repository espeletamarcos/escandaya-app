import { RecorderError, type Recorder } from "./Recorder";

/** In-memory Recorder for tests. Pass `startError` to simulate a failing microphone. */
export class FakeRecorder implements Recorder {
  private recording = false;
  private startError: RecorderError | undefined;

  constructor(startError?: RecorderError) {
    this.startError = startError;
  }

  async start(): Promise<void> {
    if (this.startError) throw this.startError;
    this.recording = true;
  }

  async stop(): Promise<Blob> {
    if (!this.recording) {
      throw new RecorderError("not-recording", "Not recording");
    }
    this.recording = false;
    return new Blob(["fake audio"], { type: "audio/webm" });
  }
}
