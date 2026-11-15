import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; data: T };

function errorMessage(error: unknown, failedMessage: string): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "network":
        return "No hay conexión. Comprueba la red e inténtalo de nuevo.";
      case "unauthorized":
        return "El acceso ya no es válido. Abre de nuevo el enlace privado.";
      case "timeout":
        return "La carga ha tardado demasiado. Inténtalo de nuevo.";
    }
  }
  return failedMessage;
}

/**
 * Load something when the screen opens, with a retry after an error.
 * It loads on mount and on retry only: a new `load` function on a later render
 * does not load again (a screen showing other data is mounted anew).
 */
export function useLoad<T>(load: () => Promise<T>, failedMessage: string) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  // Each retry bumps this, which runs the effect again.
  const [attempt, setAttempt] = useState(0);
  // The latest arguments, read when a load starts.
  const latest = useRef({ load, failedMessage });
  useEffect(() => {
    latest.current = { load, failedMessage };
  });

  useEffect(() => {
    // A result that arrives after the screen closed, or after a newer load, is dropped.
    let current = true;
    const { load, failedMessage } = latest.current;
    load().then(
      (data) => {
        if (current) setState({ status: "done", data });
      },
      (error: unknown) => {
        if (current) setState({ status: "error", error: errorMessage(error, failedMessage) });
      },
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
