import { useCallback, useEffect, useRef, useState } from "react";
import { RecorderError, type Recorder } from "./Recorder";

export type RecorderStatus = "idle" | "recording";

function errorMessage(error: unknown): string {
  if (error instanceof RecorderError) {
    switch (error.code) {
      case "permission-denied":
        return "Microphone permission was denied. Allow it in the browser settings and try again.";
      case "no-microphone":
        return "No microphone was found on this device.";
      case "unsupported":
        return "This browser cannot record audio.";
      case "empty-recording":
        return "No audio was captured. Hold on a little longer and try again.";
    }
  }
  return "Something went wrong with the recording. Please try again.";
}

export function useRecorder(recorder: Recorder) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentUrl = useRef<string | null>(null);
  const busy = useRef(false);

  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      if (status === "recording") {
        const blob = await recorder.stop();
        if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
        currentUrl.current = URL.createObjectURL(blob);
        setAudioUrl(currentUrl.current);
        setStatus("idle");
      } else {
        await recorder.start();
        setStatus("recording");
      }
    } catch (e) {
      setStatus("idle");
      setError(errorMessage(e));
    } finally {
      busy.current = false;
    }
  }, [recorder, status]);

  // Mobile browsers suspend the microphone in the background, so keep what we have.
  useEffect(() => {
    if (status !== "recording") return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void toggle();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [status, toggle]);

  return { status, audioUrl, error, toggle };
}
