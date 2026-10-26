export type RecorderErrorCode =
  | "permission-denied"
  | "no-microphone"
  | "unsupported"
  | "not-recording"
  | "empty-recording";

export class RecorderError extends Error {
  code: RecorderErrorCode;

  constructor(code: RecorderErrorCode, message: string) {
    super(message);
    this.name = "RecorderError";
    this.code = code;
  }
}

export interface Recorder {
  /** Asks for the microphone if needed and starts recording. */
  start(): Promise<void>;
  /** Stops recording, releases the microphone and returns the audio. */
  stop(): Promise<Blob>;
}
