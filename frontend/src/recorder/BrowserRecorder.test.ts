import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRecorder } from "./BrowserRecorder";

const constructed: Array<{ mimeType: string | undefined }> = [];
let supportedTypes: string[] = [];
let emitData = true;

class FakeMediaRecorder {
  static isTypeSupported(type: string) {
    return supportedTypes.includes(type);
  }

  mimeType: string;
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? "audio/default";
    constructed.push({ mimeType: options?.mimeType });
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    if (emitData) this.ondataavailable?.({ data: new Blob(["chunk"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function fakeStream() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}

function mockMicrophone(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(getUserMedia) },
    configurable: true,
  });
}

describe("BrowserRecorder", () => {
  beforeEach(() => {
    constructed.length = 0;
    supportedTypes = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
    emitData = true;
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("uses the first supported mime type", async () => {
    supportedTypes = ["audio/mp4", "audio/webm"];
    mockMicrophone(async () => fakeStream().stream);
    await new BrowserRecorder().start();
    expect(constructed[0].mimeType).toBe("audio/mp4");
  });

  it("falls back to the browser default when no mime type is supported", async () => {
    supportedTypes = [];
    mockMicrophone(async () => fakeStream().stream);
    await new BrowserRecorder().start();
    expect(constructed[0].mimeType).toBeUndefined();
  });

  it("returns the recorded audio and releases the microphone on stop", async () => {
    const { stream, track } = fakeStream();
    mockMicrophone(async () => stream);
    const recorder = new BrowserRecorder();
    await recorder.start();
    const blob = await recorder.stop();
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("audio/webm;codecs=opus");
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("can record again after stopping", async () => {
    mockMicrophone(async () => fakeStream().stream);
    const recorder = new BrowserRecorder();
    await recorder.start();
    await recorder.stop();
    await recorder.start();
    const blob = await recorder.stop();
    expect(blob.size).toBeGreaterThan(0);
  });

  it("rejects an empty recording and still releases the microphone", async () => {
    const { stream, track } = fakeStream();
    mockMicrophone(async () => stream);
    emitData = false;
    const recorder = new BrowserRecorder();
    await recorder.start();
    await expect(recorder.stop()).rejects.toMatchObject({ code: "empty-recording" });
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("maps a denied permission to permission-denied", async () => {
    mockMicrophone(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    await expect(new BrowserRecorder().start()).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("maps a missing device to no-microphone", async () => {
    mockMicrophone(() => Promise.reject(new DOMException("none", "NotFoundError")));
    await expect(new BrowserRecorder().start()).rejects.toMatchObject({
      code: "no-microphone",
    });
  });

  it("reports unsupported when the browser has no microphone api", async () => {
    await expect(new BrowserRecorder().start()).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("rejects stop when not recording", async () => {
    await expect(new BrowserRecorder().stop()).rejects.toMatchObject({
      code: "not-recording",
    });
  });
});
