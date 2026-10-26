import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRecorder } from "./FakeRecorder";
import { RecorderError } from "./Recorder";
import { useRecorder } from "./useRecorder";

describe("useRecorder", () => {
  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts idle with no recording", () => {
    const recorder = new FakeRecorder();
    const { result } = renderHook(() => useRecorder(recorder));
    expect(result.current.status).toBe("idle");
    expect(result.current.audioUrl).toBeNull();
  });

  it("is recording after the first toggle (01-C1)", async () => {
    const recorder = new FakeRecorder();
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    expect(result.current.status).toBe("recording");
    expect(result.current.audioUrl).toBeNull();
  });

  it("returns to idle with the audio url after the second toggle (01-C2)", async () => {
    const recorder = new FakeRecorder();
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    await act(() => result.current.toggle());
    expect(result.current.status).toBe("idle");
    expect(result.current.audioUrl).toBe("blob:fake-url");
  });

  it("does not revoke anything after the first recording", async () => {
    const recorder = new FakeRecorder();
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    await act(() => result.current.toggle());
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("replaces the previous recording and revokes its url (01-C6)", async () => {
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const recorder = new FakeRecorder();
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    await act(() => result.current.toggle());
    await act(() => result.current.toggle());
    await act(() => result.current.toggle());
    expect(result.current.audioUrl).toBe("blob:second");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });

  it("shows a readable message when permission is denied (01-C4)", async () => {
    const recorder = new FakeRecorder(new RecorderError("permission-denied", "Denied"));
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toMatch(/permission/i);
  });

  it("shows a readable message when there is no microphone (01-C4)", async () => {
    const recorder = new FakeRecorder(new RecorderError("no-microphone", "None"));
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toMatch(/microphone/i);
  });

  it("shows a generic message for unexpected errors (01-C4)", async () => {
    const recorder = new FakeRecorder();
    vi.spyOn(recorder, "start").mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toMatch(/try again/i);
  });

  it("clears the error on the next attempt", async () => {
    const recorder = new FakeRecorder();
    vi.spyOn(recorder, "start").mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    await act(() => result.current.toggle());
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("recording");
  });

  it("ignores a second press while the first one is still starting", async () => {
    const recorder = new FakeRecorder();
    const start = vi.spyOn(recorder, "start");
    const { result } = renderHook(() => useRecorder(recorder));
    await act(async () => {
      void result.current.toggle();
      void result.current.toggle();
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("recording");
  });

  it("shows a message when nothing was captured", async () => {
    const recorder = new FakeRecorder();
    vi.spyOn(recorder, "stop").mockRejectedValue(
      new RecorderError("empty-recording", "Empty"),
    );
    const { result } = renderHook(() => useRecorder(recorder));
    await act(() => result.current.toggle());
    await act(() => result.current.toggle());
    expect(result.current.status).toBe("idle");
    expect(result.current.audioUrl).toBeNull();
    expect(result.current.error).toMatch(/no audio/i);
  });

  describe("when the tab goes to the background", () => {
    function setVisibility(state: "hidden" | "visible") {
      Object.defineProperty(document, "visibilityState", {
        value: state,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }

    afterEach(() => {
      Reflect.deleteProperty(document, "visibilityState");
    });

    it("stops recording and keeps the audio captured so far", async () => {
      const recorder = new FakeRecorder();
      const { result } = renderHook(() => useRecorder(recorder));
      await act(() => result.current.toggle());
      await act(async () => setVisibility("hidden"));
      expect(result.current.status).toBe("idle");
      expect(result.current.audioUrl).toBe("blob:fake-url");
    });

    it("does nothing when not recording", async () => {
      const recorder = new FakeRecorder();
      const stop = vi.spyOn(recorder, "stop");
      const { result } = renderHook(() => useRecorder(recorder));
      await act(async () => setVisibility("hidden"));
      expect(stop).not.toHaveBeenCalled();
      expect(result.current.status).toBe("idle");
    });
  });
});
