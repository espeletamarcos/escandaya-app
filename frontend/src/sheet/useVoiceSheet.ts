import { useCallback, useRef, useState } from "react";
import { ApiError } from "../api/client";
import type { Draft, Sheet } from "./types";

export type VoiceSheetStep =
  | "idle"
  | "transcribing"
  | "structuring"
  | "done"
  | "no-voice"
  | "not-preparation"
  | "error";

export type TranscribeFn = (audio: Blob) => Promise<string>;
export type CreateDraftFn = (text: string) => Promise<Draft>;

type FailedStep = "transcribing" | "structuring";

function errorMessage(error: unknown, step: FailedStep): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "network":
        return "No hay conexión. Comprueba la red e inténtalo de nuevo.";
      case "unauthorized":
        return "El acceso ya no es válido. Abre de nuevo el enlace privado.";
    }
    if (step === "transcribing") {
      switch (error.kind) {
        case "too-large":
          return "La grabación es demasiado grande. Graba una nota de 2 minutos como máximo.";
        case "unsupported":
          return "El formato de audio de este navegador no está soportado.";
        case "failed":
          return "No se ha podido transcribir la nota. Inténtalo de nuevo.";
        case "timeout":
          return "La transcripción ha tardado demasiado. Inténtalo de nuevo.";
      }
    } else {
      switch (error.kind) {
        case "failed":
          return "No se ha podido crear la ficha. Inténtalo de nuevo.";
        case "timeout":
          return "La creación de la ficha ha tardado demasiado. Inténtalo de nuevo.";
      }
    }
  }
  return step === "transcribing"
    ? "Algo ha fallado al transcribir. Inténtalo de nuevo."
    : "Algo ha fallado al crear la ficha. Inténtalo de nuevo.";
}

/**
 * From the recording to the sheet: transcribe, then structure the text.
 * Both client functions are injected so tests can pass fakes.
 *
 * The transcript is kept until `reset()`, so a retry after a structuring error
 * sends only the text: the audio is not transcribed (and paid for) twice.
 */
export function useVoiceSheet(transcribeFn: TranscribeFn, createDraftFn: CreateDraftFn) {
  const [step, setStep] = useState<VoiceSheetStep>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // The state above is for rendering; `run` reads the transcript from this ref,
  // which is up to date even inside a call that started before a render.
  const transcriptRef = useRef<string | null>(null);
  // Id of the latest run; a result whose id no longer matches is outdated.
  const requestId = useRef(0);
  const pending = useRef(false);

  const run = useCallback(
    async (audio: Blob) => {
      if (pending.current) return;
      pending.current = true;
      const id = ++requestId.current;
      const outdated = () => id !== requestId.current;
      setError(null);
      setSheet(null);
      setMissing([]);

      let failedStep: FailedStep = "transcribing";
      try {
        let text = transcriptRef.current;
        if (text === null) {
          setStep("transcribing");
          const result = await transcribeFn(audio);
          if (outdated()) return;
          transcriptRef.current = result;
          setTranscript(result);
          text = result;
        }
        if (!text.trim()) {
          setStep("no-voice");
          return;
        }

        failedStep = "structuring";
        setStep("structuring");
        const draft = await createDraftFn(text);
        if (outdated()) return;
        if (!draft.is_preparation) {
          setStep("not-preparation");
          return;
        }
        setSheet(draft.sheet);
        setMissing(draft.missing);
        setStep("done");
      } catch (e) {
        if (outdated()) return;
        setError(errorMessage(e, failedStep));
        setStep("error");
      } finally {
        if (!outdated()) pending.current = false;
      }
    },
    [transcribeFn, createDraftFn],
  );

  /** Forget the transcript and the sheet of the old recording, and drop any late result. */
  const reset = useCallback(() => {
    requestId.current++;
    pending.current = false;
    transcriptRef.current = null;
    setStep("idle");
    setTranscript(null);
    setSheet(null);
    setMissing([]);
    setError(null);
  }, []);

  return { step, transcript, sheet, missing, error, run, reset };
}
