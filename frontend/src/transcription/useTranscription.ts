import { useCallback, useRef, useState } from "react";
import { ApiError } from "../api/client";

export type TranscriptionStatus = "idle" | "pending" | "done" | "error";

export type TranscribeFn = (audio: Blob) => Promise<string>;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "too-large":
        return "La grabación es demasiado grande. Graba una nota de 2 minutos como máximo.";
      case "unsupported":
        return "El formato de audio de este navegador no está soportado.";
      case "failed":
        return "No se ha podido transcribir la nota. Inténtalo de nuevo.";
      case "timeout":
        return "La transcripción ha tardado demasiado. Inténtalo de nuevo.";
      case "network":
        return "No hay conexión. Comprueba la red e inténtalo de nuevo.";
      case "unauthorized":
        return "El acceso ya no es válido. Abre de nuevo el enlace privado.";
    }
  }
  return "Algo ha fallado al transcribir. Inténtalo de nuevo.";
}

/**
 * State of the transcription of the current recording. `transcribeFn` is
 * injected so tests can pass a fake instead of the API client.
 */
export function useTranscription(transcribeFn: TranscribeFn) {
  const [status, setStatus] = useState<TranscriptionStatus>("idle");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Id of the latest request; a result whose id no longer matches is outdated.
  const requestId = useRef(0);
  const pending = useRef(false);

  const transcribe = useCallback(
    async (audio: Blob) => {
      if (pending.current) return;
      pending.current = true;
      const id = ++requestId.current;
      setStatus("pending");
      setText(null);
      setError(null);
      try {
        const result = await transcribeFn(audio);
        if (id !== requestId.current) return;
        setText(result);
        setStatus("done");
      } catch (e) {
        if (id !== requestId.current) return;
        setError(errorMessage(e));
        setStatus("error");
      } finally {
        if (id === requestId.current) pending.current = false;
      }
    },
    [transcribeFn],
  );

  /** Forget the current transcript, and drop any request still running. */
  const reset = useCallback(() => {
    requestId.current++;
    pending.current = false;
    setStatus("idle");
    setText(null);
    setError(null);
  }, []);

  return { status, text, error, transcribe, reset };
}
