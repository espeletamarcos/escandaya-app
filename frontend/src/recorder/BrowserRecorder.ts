import { RecorderError, type Recorder } from "./Recorder";

// iOS Safari records mp4, Chrome and Firefox record webm.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];

export class BrowserRecorder implements Recorder {
  private stream: MediaStream | undefined;
  private mediaRecorder: MediaRecorder | undefined;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new RecorderError("unsupported", "This browser cannot record audio");
    }

    const stream = await this.openMicrophone();
    try {
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      mediaRecorder.ondataavailable = (event) => this.chunks.push(event.data);
      mediaRecorder.start();
      this.stream = stream;
      this.mediaRecorder = mediaRecorder;
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }

  stop(): Promise<Blob> {
    const mediaRecorder = this.mediaRecorder;
    if (!mediaRecorder || mediaRecorder.state !== "recording") {
      return Promise.reject(new RecorderError("not-recording", "Not recording"));
    }

    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = () => {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = undefined;
        this.mediaRecorder = undefined;
        const blob = new Blob(this.chunks, { type: mediaRecorder.mimeType });
        if (blob.size === 0) {
          reject(new RecorderError("empty-recording", "Nothing was recorded"));
        } else {
          resolve(blob);
        }
      };
      mediaRecorder.stop();
    });
  }

  private async openMicrophone(): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new RecorderError("permission-denied", "Microphone permission denied");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new RecorderError("no-microphone", "No microphone found");
      }
      throw error;
    }
  }
}
