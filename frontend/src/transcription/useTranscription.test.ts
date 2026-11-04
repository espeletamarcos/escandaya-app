import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type ApiErrorKind } from "../api/client";
import { useTranscription } from "./useTranscription";

const audio = new Blob(["fake audio"], { type: "audio/webm" });

/** A transcribe function whose result the test settles by hand. */
function deferredTranscribe() {
  const calls: {
    resolve: (text: string) => void;
    reject: (error: unknown) => void;
  }[] = [];
  const fn = vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  return { fn, calls };
}

describe("useTranscription", () => {
  it("starts idle with no text and no error", () => {
    const { result } = renderHook(() => useTranscription(vi.fn()));
    expect(result.current.status).toBe("idle");
    expect(result.current.text).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("is pending while the request runs, then done with the text (03-C4)", async () => {
    const { fn, calls } = deferredTranscribe();
    const { result } = renderHook(() => useTranscription(fn));

    act(() => {
      void result.current.transcribe(audio);
    });
    expect(result.current.status).toBe("pending");
    expect(fn).toHaveBeenCalledWith(audio);

    await act(async () => calls[0].resolve("200 g de harina"));
    expect(result.current.status).toBe("done");
    expect(result.current.text).toBe("200 g de harina");
    expect(result.current.error).toBeNull();
  });

  it("is done with empty text when no speech was detected", async () => {
    const { result } = renderHook(() => useTranscription(vi.fn().mockResolvedValue("")));
    await act(async () => result.current.transcribe(audio));
    expect(result.current.status).toBe("done");
    expect(result.current.text).toBe("");
  });

  it("sends only one request when called twice while pending", async () => {
    const { fn, calls } = deferredTranscribe();
    const { result } = renderHook(() => useTranscription(fn));

    act(() => {
      void result.current.transcribe(audio);
      void result.current.transcribe(audio);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => calls[0].resolve("texto"));
    expect(result.current.status).toBe("done");
  });

  it.each<[ApiErrorKind, RegExp]>([
    ["too-large", /2 minutos|grande/i],
    ["unsupported", /formato/i],
    ["failed", /no se ha podido transcribir/i],
    ["timeout", /tardado demasiado/i],
    ["network", /conexión/i],
    ["unauthorized", /acceso/i],
  ])("shows a readable message for a %s error (03-C7)", async (kind, message) => {
    const fn = vi.fn().mockRejectedValue(new ApiError(kind));
    const { result } = renderHook(() => useTranscription(fn));
    await act(async () => result.current.transcribe(audio));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(message);
    expect(result.current.text).toBeNull();
  });

  it("shows a generic message for an unexpected error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useTranscription(fn));
    await act(async () => result.current.transcribe(audio));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/inténtalo de nuevo/i);
  });

  it("can retry after an error (03-C7)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("network"))
      .mockResolvedValueOnce("texto");
    const { result } = renderHook(() => useTranscription(fn));

    await act(async () => result.current.transcribe(audio));
    expect(result.current.status).toBe("error");

    await act(async () => result.current.transcribe(audio));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("done");
    expect(result.current.text).toBe("texto");
    expect(result.current.error).toBeNull();
  });

  it("reset clears the text and the error", async () => {
    const { result } = renderHook(() => useTranscription(vi.fn().mockResolvedValue("texto")));
    await act(async () => result.current.transcribe(audio));
    act(() => {
      void result.current.reset();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.text).toBeNull();
    expect(result.current.error).toBeNull();
  });

  describe("when a new recording replaces the old one", () => {
    it("drops the result of the outdated request", async () => {
      const { fn, calls } = deferredTranscribe();
      const { result } = renderHook(() => useTranscription(fn));

      act(() => {
        void result.current.transcribe(audio);
      });
      act(() => {
        void result.current.reset();
      });
      await act(async () => calls[0].resolve("texto viejo"));

      expect(result.current.status).toBe("idle");
      expect(result.current.text).toBeNull();
    });

    it("drops the error of the outdated request", async () => {
      const { fn, calls } = deferredTranscribe();
      const { result } = renderHook(() => useTranscription(fn));

      act(() => {
        void result.current.transcribe(audio);
      });
      act(() => {
        void result.current.reset();
      });
      await act(async () => calls[0].reject(new ApiError("failed")));

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
    });

    it("lets the new recording be transcribed while the old request is still running", async () => {
      const { fn, calls } = deferredTranscribe();
      const newAudio = new Blob(["new audio"], { type: "audio/webm" });
      const { result } = renderHook(() => useTranscription(fn));

      act(() => {
        void result.current.transcribe(audio);
      });
      act(() => {
        void result.current.reset();
      });
      act(() => {
        void result.current.transcribe(newAudio);
      });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith(newAudio);

      await act(async () => calls[1].resolve("texto nuevo"));
      await act(async () => calls[0].resolve("texto viejo"));

      expect(result.current.status).toBe("done");
      expect(result.current.text).toBe("texto nuevo");
    });
  });
});
