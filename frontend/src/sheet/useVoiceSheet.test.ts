import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type ApiErrorKind } from "../api/client";
import type { Draft, Sheet } from "./types";
import { type CreateDraftFn, type TranscribeFn, useVoiceSheet } from "./useVoiceSheet";

const audio = new Blob(["fake audio"], { type: "audio/webm" });
const TRANSCRIPT = "dos kilos de atún para treinta raciones";

const SHEET: Sheet = {
  name: "Tartar de atún",
  yield: { quantity: 2, unit: "kg", estimated: false },
  covers: { value: 30, estimated: false },
  ingredients: [{ name: "atún rojo", quantity: null, unit: null, estimated: false }],
};
const DRAFT: Draft = {
  is_preparation: true,
  sheet: SHEET,
  missing: ["ingredients.0.quantity", "ingredients.0.unit"],
};
const NOT_PREPARATION: Draft = { is_preparation: false, sheet: null, missing: [] };

/** A function whose results the test settles by hand, one per call. */
function deferred<A, T>() {
  const calls: { resolve: (value: T) => void; reject: (error: unknown) => void }[] = [];
  const fn = vi.fn<(arg: A) => Promise<T>>(
    () =>
      new Promise<T>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  return { fn, calls };
}

const transcribeOk = (text = TRANSCRIPT) => vi.fn<TranscribeFn>(async () => text);
const draftOk = (draft: Draft = DRAFT) => vi.fn<CreateDraftFn>(async () => draft);
const fails = (error: unknown) =>
  vi.fn(async (): Promise<never> => {
    throw error;
  });

describe("useVoiceSheet", () => {
  it("starts idle with nothing", () => {
    const { result } = renderHook(() => useVoiceSheet(vi.fn(), vi.fn()));

    expect(result.current.step).toBe("idle");
    expect(result.current.transcript).toBeNull();
    expect(result.current.sheet).toBeNull();
    expect(result.current.missing).toEqual([]);
    expect(result.current.draftId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("gives each sheet the id of the run that produced it", async () => {
    const { result } = renderHook(() => useVoiceSheet(transcribeOk(), draftOk()));

    await act(async () => result.current.run(audio));
    const first = result.current.draftId;
    act(() => result.current.reset());
    expect(result.current.draftId).toBeNull();
    await act(async () => result.current.run(audio));

    expect(first).not.toBeNull();
    expect(result.current.draftId).not.toBeNull();
    expect(result.current.draftId).not.toBe(first);
  });

  it("transcribes, then structures the text, then is done with the sheet (04-C1)", async () => {
    const transcribe = deferred<Blob, string>();
    const createDraft = deferred<string, Draft>();
    const { result } = renderHook(() => useVoiceSheet(transcribe.fn, createDraft.fn));

    act(() => {
      void result.current.run(audio);
    });
    expect(result.current.step).toBe("transcribing");
    expect(transcribe.fn).toHaveBeenCalledWith(audio);
    expect(createDraft.fn).not.toHaveBeenCalled();

    await act(async () => transcribe.calls[0].resolve(TRANSCRIPT));
    expect(result.current.step).toBe("structuring");
    expect(createDraft.fn).toHaveBeenCalledWith(TRANSCRIPT);

    await act(async () => createDraft.calls[0].resolve(DRAFT));
    expect(result.current.step).toBe("done");
    expect(result.current.sheet).toEqual(SHEET);
    expect(result.current.missing).toEqual(DRAFT.missing);
    expect(result.current.transcript).toBe(TRANSCRIPT);
    expect(result.current.error).toBeNull();
  });

  it.each(["", "   \n "])(
    "stops at no-voice on empty text %j, without structuring",
    async (text) => {
      const createDraft = draftOk();
      const { result } = renderHook(() => useVoiceSheet(transcribeOk(text), createDraft));

      await act(async () => result.current.run(audio));

      expect(result.current.step).toBe("no-voice");
      expect(createDraft).not.toHaveBeenCalled();
      expect(result.current.sheet).toBeNull();
    },
  );

  it("stops at not-preparation without a sheet", async () => {
    const { result } = renderHook(() =>
      useVoiceSheet(transcribeOk("hola, qué tal"), draftOk(NOT_PREPARATION)),
    );

    await act(async () => result.current.run(audio));

    expect(result.current.step).toBe("not-preparation");
    expect(result.current.sheet).toBeNull();
    expect(result.current.missing).toEqual([]);
  });

  it("sends only one request when run twice while transcribing", async () => {
    const transcribe = deferred<Blob, string>();
    const createDraft = draftOk();
    const { result } = renderHook(() => useVoiceSheet(transcribe.fn, createDraft));

    act(() => {
      void result.current.run(audio);
      void result.current.run(audio);
    });
    expect(transcribe.fn).toHaveBeenCalledTimes(1);

    await act(async () => transcribe.calls[0].resolve(TRANSCRIPT));
    expect(createDraft).toHaveBeenCalledTimes(1);
    expect(result.current.step).toBe("done");
  });

  it("sends only one request when run again while structuring", async () => {
    const transcribe = transcribeOk();
    const createDraft = deferred<string, Draft>();
    const { result } = renderHook(() => useVoiceSheet(transcribe, createDraft.fn));

    await act(async () => {
      void result.current.run(audio);
    });
    expect(result.current.step).toBe("structuring");
    act(() => {
      void result.current.run(audio);
    });

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(createDraft.fn).toHaveBeenCalledTimes(1);
  });

  describe("errors (04-C7)", () => {
    it.each<[ApiErrorKind, RegExp]>([
      ["too-large", /2 minutos|grande/i],
      ["unsupported", /formato/i],
      ["failed", /no se ha podido transcribir/i],
      ["timeout", /transcripción ha tardado demasiado/i],
      ["network", /conexión/i],
      ["unauthorized", /acceso/i],
    ])("shows a transcription message for a %s error", async (kind, message) => {
      const createDraft = draftOk();
      const { result } = renderHook(() =>
        useVoiceSheet(fails(new ApiError(kind)), createDraft),
      );

      await act(async () => result.current.run(audio));

      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(message);
      expect(createDraft).not.toHaveBeenCalled();
    });

    it.each<[ApiErrorKind, RegExp]>([
      ["failed", /no se ha podido crear la ficha/i],
      ["timeout", /ficha ha tardado demasiado/i],
      ["network", /conexión/i],
      ["unauthorized", /acceso/i],
    ])("shows a structuring message for a %s error", async (kind, message) => {
      const { result } = renderHook(() =>
        useVoiceSheet(transcribeOk(), fails(new ApiError(kind))),
      );

      await act(async () => result.current.run(audio));

      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(message);
      expect(result.current.sheet).toBeNull();
      // The transcript is kept for the retry.
      expect(result.current.transcript).toBe(TRANSCRIPT);
    });

    it.each([
      ["transcribing", fails(new Error("boom")), draftOk(), /al transcribir/i],
      ["structuring", transcribeOk(), fails(new Error("boom")), /al crear la ficha/i],
    ])("shows a generic message for an unexpected error while %s", async (_, t, d, message) => {
      const { result } = renderHook(() => useVoiceSheet(t, d));

      await act(async () => result.current.run(audio));

      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(message);
    });

    it("retries a failed transcription with the same audio", async () => {
      const transcribe = vi
        .fn()
        .mockRejectedValueOnce(new ApiError("network"))
        .mockResolvedValueOnce(TRANSCRIPT);
      const { result } = renderHook(() => useVoiceSheet(transcribe, draftOk()));

      await act(async () => result.current.run(audio));
      expect(result.current.step).toBe("error");

      await act(async () => result.current.run(audio));
      expect(transcribe).toHaveBeenCalledTimes(2);
      expect(transcribe).toHaveBeenLastCalledWith(audio);
      expect(result.current.step).toBe("done");
      expect(result.current.error).toBeNull();
    });

    it("retries a failed structuring with the stored transcript only", async () => {
      const transcribe = transcribeOk();
      const createDraft = vi
        .fn()
        .mockRejectedValueOnce(new ApiError("timeout"))
        .mockResolvedValueOnce(DRAFT);
      const { result } = renderHook(() => useVoiceSheet(transcribe, createDraft));

      await act(async () => result.current.run(audio));
      expect(result.current.step).toBe("error");

      await act(async () => result.current.run(audio));
      // The audio is not sent, nor paid for, twice.
      expect(transcribe).toHaveBeenCalledTimes(1);
      expect(createDraft).toHaveBeenCalledTimes(2);
      expect(createDraft).toHaveBeenLastCalledWith(TRANSCRIPT);
      expect(result.current.step).toBe("done");
      expect(result.current.error).toBeNull();
    });
  });

  describe("reset, for a new recording", () => {
    it("clears the transcript, the sheet and the error", async () => {
      const { result } = renderHook(() => useVoiceSheet(transcribeOk(), draftOk()));
      await act(async () => result.current.run(audio));

      act(() => result.current.reset());

      expect(result.current.step).toBe("idle");
      expect(result.current.transcript).toBeNull();
      expect(result.current.sheet).toBeNull();
      expect(result.current.missing).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("transcribes the new recording instead of reusing the old transcript", async () => {
      const transcribe = vi.fn().mockResolvedValueOnce("viejo").mockResolvedValueOnce("nuevo");
      const createDraft = vi
        .fn()
        .mockRejectedValueOnce(new ApiError("failed"))
        .mockResolvedValueOnce(DRAFT);
      const newAudio = new Blob(["new audio"], { type: "audio/webm" });
      const { result } = renderHook(() => useVoiceSheet(transcribe, createDraft));
      await act(async () => result.current.run(audio));

      act(() => result.current.reset());
      await act(async () => result.current.run(newAudio));

      expect(transcribe).toHaveBeenLastCalledWith(newAudio);
      expect(createDraft).toHaveBeenLastCalledWith("nuevo");
    });

    it("drops a transcript that arrives late, without structuring it", async () => {
      const transcribe = deferred<Blob, string>();
      const createDraft = draftOk();
      const { result } = renderHook(() => useVoiceSheet(transcribe.fn, createDraft));

      act(() => {
        void result.current.run(audio);
      });
      act(() => result.current.reset());
      await act(async () => transcribe.calls[0].resolve("texto viejo"));

      expect(result.current.step).toBe("idle");
      expect(result.current.transcript).toBeNull();
      expect(createDraft).not.toHaveBeenCalled();
    });

    it("drops a sheet that arrives late", async () => {
      const createDraft = deferred<string, Draft>();
      const { result } = renderHook(() => useVoiceSheet(transcribeOk(), createDraft.fn));

      await act(async () => {
        void result.current.run(audio);
      });
      act(() => result.current.reset());
      await act(async () => createDraft.calls[0].resolve(DRAFT));

      expect(result.current.step).toBe("idle");
      expect(result.current.sheet).toBeNull();
    });

    it.each(["transcribing", "structuring"])("drops an error that arrives late while %s", async (step) => {
      const transcribe = deferred<Blob, string>();
      const createDraft = deferred<string, Draft>();
      const { result } = renderHook(() => useVoiceSheet(transcribe.fn, createDraft.fn));

      act(() => {
        void result.current.run(audio);
      });
      if (step === "structuring") {
        await act(async () => transcribe.calls[0].resolve(TRANSCRIPT));
      }
      act(() => result.current.reset());
      const late = step === "structuring" ? createDraft.calls[0] : transcribe.calls[0];
      await act(async () => late.reject(new ApiError("failed")));

      expect(result.current.step).toBe("idle");
      expect(result.current.error).toBeNull();
    });

    it("lets the new recording run while the old request is still running", async () => {
      const transcribe = deferred<Blob, string>();
      const createDraft = draftOk();
      const newAudio = new Blob(["new audio"], { type: "audio/webm" });
      const { result } = renderHook(() => useVoiceSheet(transcribe.fn, createDraft));

      act(() => {
        void result.current.run(audio);
      });
      act(() => result.current.reset());
      act(() => {
        void result.current.run(newAudio);
      });
      expect(transcribe.fn).toHaveBeenCalledTimes(2);
      expect(transcribe.fn).toHaveBeenLastCalledWith(newAudio);

      await act(async () => transcribe.calls[1].resolve("texto nuevo"));
      await act(async () => transcribe.calls[0].resolve("texto viejo"));

      expect(result.current.step).toBe("done");
      expect(result.current.transcript).toBe("texto nuevo");
      expect(createDraft).toHaveBeenCalledTimes(1);
      expect(createDraft).toHaveBeenCalledWith("texto nuevo");
    });
  });
});
