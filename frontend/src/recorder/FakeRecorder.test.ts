import { describe, expect, it } from "vitest";
import { FakeRecorder } from "./FakeRecorder";
import { RecorderError } from "./Recorder";

describe("FakeRecorder", () => {
  it("returns a blob after start and stop", async () => {
    const recorder = new FakeRecorder();
    await recorder.start();
    const blob = await recorder.stop();
    expect(blob.size).toBeGreaterThan(0);
  });

  it("rejects stop when not recording", async () => {
    const recorder = new FakeRecorder();
    await expect(recorder.stop()).rejects.toMatchObject({ code: "not-recording" });
  });

  it("rejects start with the configured error", async () => {
    const error = new RecorderError("permission-denied", "Denied");
    const recorder = new FakeRecorder(error);
    await expect(recorder.start()).rejects.toBe(error);
  });
});
