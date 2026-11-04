import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "../api/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRecorder } from "../recorder/FakeRecorder";
import { RecorderError } from "../recorder/Recorder";
import { MAX_RECORDING_MS } from "../recorder/useRecorder";
import RecordScreen from "./RecordScreen";

describe("RecordScreen", () => {
  beforeEach(() => {
    // jsdom does not implement object URLs
    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a record button and no player at first", () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    expect(screen.getByRole("button", { name: "Record" })).toBeDefined();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("shows the recording state after pressing the button (01-C1)", async () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    const stop = await screen.findByRole("button", { name: "Stop" });
    expect(stop.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Recording…")).toBeDefined();
  });

  it("shows a player with the recording after stopping (01-C2)", async () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    await screen.findByRole("button", { name: "Record" });
    const audio = document.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("blob:fake-url");
    expect(audio?.hasAttribute("controls")).toBe(true);
  });

  it("shows the error message when the microphone is not available (01-C4)", async () => {
    const recorder = new FakeRecorder(new RecorderError("no-microphone", "None"));
    render(<RecordScreen recorder={recorder} />);
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/microphone/i);
    expect(screen.getByRole("button", { name: "Record" })).toBeDefined();
  });

  describe("transcription", () => {
    /** A transcribe fake whose result the test settles by hand. */
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

    async function record() {
      fireEvent.click(screen.getByRole("button", { name: "Record" }));
      fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
      await screen.findByRole("button", { name: "Record" });
    }

    it("shows no transcribe button before anything is recorded", () => {
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "Transcribir" })).toBeNull();
    });

    it("hides the transcribe button while recording", async () => {
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={vi.fn()} />);
      await record();
      fireEvent.click(screen.getByRole("button", { name: "Record" }));
      await screen.findByRole("button", { name: "Stop" });
      expect(screen.queryByRole("button", { name: "Transcribir" })).toBeNull();
    });

    it("sends the recording and disables the button while pending (03-C4)", async () => {
      const { fn } = deferredTranscribe();
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={fn} />);
      await record();

      const button = screen.getByRole("button", { name: "Transcribir" });
      fireEvent.click(button);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(expect.any(Blob));
      expect(button.hasAttribute("disabled")).toBe(true);
      expect(await screen.findByText("Transcribiendo…")).toBeDefined();
    });

    it("shows the transcript under the player when it arrives (03-C4)", async () => {
      const { fn, calls } = deferredTranscribe();
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={fn} />);
      await record();
      fireEvent.click(screen.getByRole("button", { name: "Transcribir" }));

      calls[0].resolve("200 g de harina y 3 huevos");

      const transcript = await screen.findByText("200 g de harina y 3 huevos");
      expect(transcript.tagName).toBe("P");
      expect(screen.queryByText("Transcribiendo…")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Transcribir" }).hasAttribute("disabled"),
      ).toBe(false);
    });

    it.each(["", "   "])(
      "shows a notice when no speech was detected (text %j)",
      async (text) => {
        const transcribe = vi.fn().mockResolvedValue(text);
        render(<RecordScreen recorder={new FakeRecorder()} transcribe={transcribe} />);
        await record();
        fireEvent.click(screen.getByRole("button", { name: "Transcribir" }));
        expect(await screen.findByText("No se ha detectado voz")).toBeDefined();
      },
    );

    it("shows a readable error, keeps the recording and lets the chef retry (03-C7)", async () => {
      const transcribe = vi
        .fn()
        .mockRejectedValueOnce(new ApiError("network"))
        .mockResolvedValueOnce("texto de la receta");
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={transcribe} />);
      await record();

      fireEvent.click(screen.getByRole("button", { name: "Transcribir" }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/conexión/i);
      expect(document.querySelector("audio")?.getAttribute("src")).toBe("blob:fake-url");

      fireEvent.click(screen.getByRole("button", { name: "Transcribir" }));
      expect(await screen.findByText("texto de la receta")).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(transcribe).toHaveBeenCalledTimes(2);
    });

    it("shows a readable message when the recording is too large (03-C6)", async () => {
      const transcribe = vi.fn().mockRejectedValue(new ApiError("too-large"));
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={transcribe} />);
      await record();
      fireEvent.click(screen.getByRole("button", { name: "Transcribir" }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/demasiado grande/i);
    });

    it("clears the transcript when a new recording starts", async () => {
      const transcribe = vi.fn().mockResolvedValue("texto viejo");
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={transcribe} />);
      await record();
      fireEvent.click(screen.getByRole("button", { name: "Transcribir" }));
      await screen.findByText("texto viejo");

      fireEvent.click(screen.getByRole("button", { name: "Record" }));
      await screen.findByRole("button", { name: "Stop" });
      expect(screen.queryByText("texto viejo")).toBeNull();
    });

    it("ignores the result of the old recording if it arrives late", async () => {
      const { fn, calls } = deferredTranscribe();
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={fn} />);
      await record();
      fireEvent.click(screen.getByRole("button", { name: "Transcribir" }));

      await record();
      await act(async () => calls[0].resolve("texto viejo"));

      expect(screen.queryByText("texto viejo")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Transcribir" }).hasAttribute("disabled"),
      ).toBe(false);
    });
  });

  describe("recording time limit (03-C6)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function advance(ms: number) {
      await act(() => vi.advanceTimersByTimeAsync(ms));
    }

    async function click(name: string) {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name }));
      });
    }

    it("shows the elapsed time against the limit while recording", async () => {
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={vi.fn()} />);
      await click("Record");
      expect(screen.getByRole("timer").textContent).toBe("0:00 / 2:00");

      await advance(45_000);
      expect(screen.getByRole("timer").textContent).toBe("0:45 / 2:00");
    });

    it("hides the timer when not recording", async () => {
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={vi.fn()} />);
      expect(screen.queryByRole("timer")).toBeNull();
      await click("Record");
      await advance(5_000);
      await click("Stop");
      expect(screen.queryByRole("timer")).toBeNull();
    });

    it("stops at 2:00 with a notice, and keeps the recording ready to transcribe", async () => {
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={vi.fn()} />);
      await click("Record");
      await advance(MAX_RECORDING_MS);

      expect(screen.getByRole("button", { name: "Record" })).toBeDefined();
      expect(screen.getByRole("status").textContent).toBe(
        "Se ha alcanzado el límite de 2 minutos",
      );
      expect(document.querySelector("audio")?.getAttribute("src")).toBe("blob:fake-url");
      expect(screen.getByRole("button", { name: "Transcribir" })).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("clears the notice when a new recording starts", async () => {
      render(<RecordScreen recorder={new FakeRecorder()} transcribe={vi.fn()} />);
      await click("Record");
      await advance(MAX_RECORDING_MS);
      await click("Record");
      expect(screen.queryByText("Se ha alcanzado el límite de 2 minutos")).toBeNull();
    });
  });
});
