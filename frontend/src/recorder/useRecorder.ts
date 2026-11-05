import { useCallback, useEffect, useRef, useState } from "react";
import { RecorderError, type Recorder } from "./Recorder";

export type RecorderStatus = "idle" | "recording";

/** Recordings stop by themselves after 2 minutes (03-C6). */
export const MAX_RECORDING_MS = 120_000;

const TICK_MS = 250;
const LIMIT_NOTICE = "Se ha alcanzado el límite de 2 minutos";

/** Format whole seconds as `m:ss`. */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof RecorderError) {
    switch (error.code) {
      case "permission-denied":
        return "Se ha denegado el permiso del micrófono. Actívalo en los ajustes del navegador e inténtalo de nuevo.";
      case "no-microphone":
        return "No se ha encontrado ningún micrófono en este dispositivo.";
      case "unsupported":
        return "Este navegador no puede grabar audio.";
      case "empty-recording":
        return "No se ha captado audio. Graba un poco más e inténtalo de nuevo.";
    }
  }
  return "Algo ha fallado con la grabación. Inténtalo de nuevo.";
}

export function useRecorder(recorder: Recorder) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const currentUrl = useRef<string | null>(null);
  const busy = useRef(false);

  const stop = useCallback(
    async (limitReached: boolean) => {
      const blob = await recorder.stop();
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = URL.createObjectURL(blob);
      setAudio(blob);
      setAudioUrl(currentUrl.current);
      setStatus("idle");
      if (limitReached) setNotice(LIMIT_NOTICE);
    },
    [recorder],
  );

  const run = useCallback(
    async (limitReached: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setError(null);
      try {
        if (status === "recording") {
          await stop(limitReached);
        } else {
          setNotice(null);
          setElapsed(0);
          await recorder.start();
          setStatus("recording");
        }
      } catch (e) {
        setStatus("idle");
        setError(errorMessage(e));
      } finally {
        busy.current = false;
      }
    },
    [recorder, status, stop],
  );

  const toggle = useCallback(() => run(false), [run]);

  // Count the time and stop at the limit. The time is read from the clock, so
  // a delayed tick does not make the counter fall behind.
  useEffect(() => {
    if (status !== "recording") return;
    const startedAt = Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, TICK_MS);
    const limit = setTimeout(() => {
      setElapsed(MAX_RECORDING_MS / 1000);
      void run(true);
    }, MAX_RECORDING_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(limit);
    };
  }, [status, run]);

  // Mobile browsers suspend the microphone in the background, so keep what we have.
  useEffect(() => {
    if (status !== "recording") return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void toggle();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [status, toggle]);

  return { status, audio, audioUrl, error, notice, elapsed, toggle };
}
