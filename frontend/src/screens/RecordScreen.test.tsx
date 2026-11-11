import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "../api/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRecorder } from "../recorder/FakeRecorder";
import { RecorderError } from "../recorder/Recorder";
import { MAX_RECORDING_MS } from "../recorder/useRecorder";
import type { Draft, Sheet } from "../sheet/types";
import type { CreateDraftFn, TranscribeFn } from "../sheet/useVoiceSheet";
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
    expect(screen.getByRole("button", { name: "Grabar" })).toBeDefined();
    expect(document.querySelector("audio")).toBeNull();
  });

  it("shows the recording state after pressing the button (01-C1)", async () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
    const stop = await screen.findByRole("button", { name: "Parar" });
    expect(stop.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Grabando…")).toBeDefined();
  });

  it("shows a player with the recording after stopping (01-C2)", async () => {
    render(<RecordScreen recorder={new FakeRecorder()} />);
    fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Parar" }));
    await screen.findByRole("button", { name: "Grabar" });
    const audio = document.querySelector("audio");
    expect(audio?.getAttribute("src")).toBe("blob:fake-url");
    expect(audio?.hasAttribute("controls")).toBe(true);
  });

  it("shows the error message when the microphone is not available (01-C4)", async () => {
    const recorder = new FakeRecorder(new RecorderError("no-microphone", "None"));
    render(<RecordScreen recorder={recorder} />);
    fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "No se ha encontrado ningún micrófono en este dispositivo.",
    );
    expect(screen.getByRole("button", { name: "Grabar" })).toBeDefined();
  });

  describe("voice sheet", () => {
    const BUTTON = "Transcribir y crear ficha";
    const TRANSCRIPT = "dos kilos y medio de tartar, treinta raciones";
    const SHEET: Sheet = {
      name: "Tartar de atún",
      yield: { quantity: 2.5, unit: "kg", estimated: false },
      covers: { value: 30, estimated: false },
      ingredients: [
        { name: "atún rojo", quantity: 1.5, unit: "kg", estimated: false },
        { name: "cebollino", quantity: null, unit: null, estimated: false },
      ],
    };
    const DRAFT: Draft = {
      is_preparation: true,
      sheet: SHEET,
      missing: ["ingredients.1.quantity", "ingredients.1.unit"],
    };

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

    function renderScreen(
      transcribe: TranscribeFn = transcribeOk(),
      createDraft: CreateDraftFn = draftOk(),
    ) {
      render(
        <RecordScreen
          recorder={new FakeRecorder()}
          transcribe={transcribe}
          createDraft={createDraft}
        />,
      );
    }

    async function record() {
      fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
      fireEvent.click(await screen.findByRole("button", { name: "Parar" }));
      await screen.findByRole("button", { name: "Grabar" });
    }

    const button = () => screen.getByRole("button", { name: BUTTON });
    const isDisabled = () => button().hasAttribute("disabled");
    const sheetForm = () => screen.queryByRole("form", { name: "Ficha" });
    const sheetName = () =>
      screen
        .getAllByLabelText("Nombre")
        .find((el) => el.closest("fieldset") === null) as HTMLInputElement;

    it("shows no button before anything is recorded", () => {
      renderScreen();
      expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    });

    it("hides the button while recording", async () => {
      renderScreen();
      await record();
      fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
      await screen.findByRole("button", { name: "Parar" });
      expect(screen.queryByRole("button", { name: BUTTON })).toBeNull();
    });

    it("transcribes, then creates the sheet, each step shown, the button disabled (04-C1)", async () => {
      const transcribe = deferred<Blob, string>();
      const createDraft = deferred<string, Draft>();
      renderScreen(transcribe.fn, createDraft.fn);
      await record();

      fireEvent.click(button());
      expect(transcribe.fn).toHaveBeenCalledWith(expect.any(Blob));
      expect(await screen.findByText("Transcribiendo…")).toBeDefined();
      expect(isDisabled()).toBe(true);
      expect(createDraft.fn).not.toHaveBeenCalled();

      await act(async () => transcribe.calls[0].resolve(TRANSCRIPT));
      expect(screen.getByText("Creando ficha…")).toBeDefined();
      expect(screen.queryByText("Transcribiendo…")).toBeNull();
      expect(createDraft.fn).toHaveBeenCalledWith(TRANSCRIPT);
      expect(isDisabled()).toBe(true);

      await act(async () => createDraft.calls[0].resolve(DRAFT));
      expect(sheetForm()).not.toBeNull();
      expect(sheetName().value).toBe("Tartar de atún");
      expect(screen.queryByText("Creando ficha…")).toBeNull();
    });

    it("never shows the transcript (04-C5)", async () => {
      renderScreen();
      await record();
      fireEvent.click(button());
      await screen.findByRole("form", { name: "Ficha" });

      expect(document.body.textContent).not.toContain(TRANSCRIPT);
    });

    it("first marks exactly the fields the backend marked as missing (04-C5)", async () => {
      renderScreen();
      await record();
      fireEvent.click(button());
      await screen.findByRole("form", { name: "Ficha" });

      const marked = Array.from(document.querySelectorAll("[aria-invalid='true']")).map((el) =>
        el.getAttribute("name"),
      );
      expect(marked).toEqual(DRAFT.missing);
    });

    it("keeps the button disabled after the sheet is shown (04-C1)", async () => {
      const transcribe = transcribeOk();
      const createDraft = draftOk();
      renderScreen(transcribe, createDraft);
      await record();
      fireEvent.click(button());
      await screen.findByRole("form", { name: "Ficha" });

      expect(isDisabled()).toBe(true);
      fireEvent.click(button());
      expect(transcribe).toHaveBeenCalledTimes(1);
      expect(createDraft).toHaveBeenCalledTimes(1);
    });

    it("says when the note is not a preparation, and keeps the button disabled", async () => {
      renderScreen(
        transcribeOk("hola, qué tal"),
        draftOk({ is_preparation: false, sheet: null, missing: [] }),
      );
      await record();
      fireEvent.click(button());

      expect(await screen.findByText("No parece una preparación")).toBeDefined();
      expect(sheetForm()).toBeNull();
      expect(isDisabled()).toBe(true);
    });

    it.each(["", "   "])(
      "says when no speech was detected (text %j), without creating a sheet",
      async (text) => {
        const createDraft = draftOk();
        renderScreen(transcribeOk(text), createDraft);
        await record();
        fireEvent.click(button());

        expect(await screen.findByText("No se ha detectado voz")).toBeDefined();
        expect(createDraft).not.toHaveBeenCalled();
        // Silent audio will not improve on a second try.
        expect(isDisabled()).toBe(true);
      },
    );

    it("shows a readable error, keeps the audio and retries the transcription (04-C7)", async () => {
      const transcribe = vi
        .fn<TranscribeFn>()
        .mockRejectedValueOnce(new ApiError("network"))
        .mockResolvedValueOnce(TRANSCRIPT);
      renderScreen(transcribe);
      await record();

      fireEvent.click(button());
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/conexión/i);
      expect(document.querySelector("audio")?.getAttribute("src")).toBe("blob:fake-url");
      expect(isDisabled()).toBe(false);

      fireEvent.click(button());
      await screen.findByRole("form", { name: "Ficha" });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(transcribe).toHaveBeenCalledTimes(2);
    });

    it("retries a failed sheet without transcribing the audio again (04-C7)", async () => {
      const transcribe = transcribeOk();
      const createDraft = vi
        .fn<CreateDraftFn>()
        .mockRejectedValueOnce(new ApiError("failed"))
        .mockResolvedValueOnce(DRAFT);
      renderScreen(transcribe, createDraft);
      await record();

      fireEvent.click(button());
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/no se ha podido crear la ficha/i);
      expect(isDisabled()).toBe(false);

      fireEvent.click(button());
      await screen.findByRole("form", { name: "Ficha" });
      expect(transcribe).toHaveBeenCalledTimes(1);
      expect(createDraft).toHaveBeenCalledTimes(2);
    });

    it("shows a readable message when the recording is too large (03-C6)", async () => {
      renderScreen(vi.fn<TranscribeFn>().mockRejectedValue(new ApiError("too-large")));
      await record();
      fireEvent.click(button());
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/demasiado grande/i);
    });

    it("discards the sheet and its edits when a new recording starts", async () => {
      const transcribe = transcribeOk();
      renderScreen(
        transcribe,
        vi
          .fn<CreateDraftFn>()
          .mockResolvedValueOnce(DRAFT)
          .mockResolvedValueOnce({ ...DRAFT, sheet: { ...SHEET, name: "Fondo oscuro" } }),
      );
      await record();
      fireEvent.click(button());
      await screen.findByRole("form", { name: "Ficha" });
      fireEvent.change(sheetName(), { target: { value: "Editado" } });

      fireEvent.click(screen.getByRole("button", { name: "Grabar" }));
      await screen.findByRole("button", { name: "Parar" });
      expect(sheetForm()).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Parar" }));
      await screen.findByRole("button", { name: "Grabar" });
      expect(isDisabled()).toBe(false);
      fireEvent.click(button());
      await screen.findByRole("form", { name: "Ficha" });

      expect(transcribe).toHaveBeenCalledTimes(2);
      expect(sheetName().value).toBe("Fondo oscuro");
    });

    it("ignores the sheet of the old recording if it arrives late", async () => {
      const createDraft = deferred<string, Draft>();
      renderScreen(transcribeOk(), createDraft.fn);
      await record();
      fireEvent.click(button());
      await screen.findByText("Creando ficha…");

      await record();
      await act(async () => createDraft.calls[0].resolve(DRAFT));

      expect(sheetForm()).toBeNull();
      expect(isDisabled()).toBe(false);
    });
  });

  describe("recording time limit (03-C6)", () => {
    const renderWithFakes = () =>
      render(
        <RecordScreen recorder={new FakeRecorder()} transcribe={vi.fn()} createDraft={vi.fn()} />,
      );

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
      renderWithFakes();
      await click("Grabar");
      expect(screen.getByRole("timer").textContent).toBe("0:00 / 2:00");

      await advance(45_000);
      expect(screen.getByRole("timer").textContent).toBe("0:45 / 2:00");
    });

    it("hides the timer when not recording", async () => {
      renderWithFakes();
      expect(screen.queryByRole("timer")).toBeNull();
      await click("Grabar");
      await advance(5_000);
      await click("Parar");
      expect(screen.queryByRole("timer")).toBeNull();
    });

    it("stops at 2:00 with a notice, and keeps the recording ready to transcribe", async () => {
      renderWithFakes();
      await click("Grabar");
      await advance(MAX_RECORDING_MS);

      expect(screen.getByRole("button", { name: "Grabar" })).toBeDefined();
      expect(screen.getByRole("status").textContent).toBe(
        "Se ha alcanzado el límite de 2 minutos",
      );
      expect(document.querySelector("audio")?.getAttribute("src")).toBe("blob:fake-url");
      expect(screen.getByRole("button", { name: "Transcribir y crear ficha" })).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("clears the notice when a new recording starts", async () => {
      renderWithFakes();
      await click("Grabar");
      await advance(MAX_RECORDING_MS);
      await click("Grabar");
      expect(screen.queryByText("Se ha alcanzado el límite de 2 minutos")).toBeNull();
    });
  });
});
