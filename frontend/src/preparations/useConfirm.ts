import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import type { Sheet } from "../sheet/types";
import type { ConfirmInput, SavedPreparation } from "./types";

export type ConfirmFn = (input: ConfirmInput) => Promise<SavedPreparation>;

export type ConfirmStatus = "idle" | "pending" | "saved" | "error";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case "network":
        return "No hay conexión. La ficha no se ha guardado: comprueba la red e inténtalo de nuevo.";
      case "unauthorized":
        return "El acceso ya no es válido. Abre de nuevo el enlace privado.";
      case "invalid":
        return "La ficha tiene valores no válidos. Revísala e inténtalo de nuevo.";
      case "timeout":
        return "Guardar la ficha ha tardado demasiado. Inténtalo de nuevo.";
    }
  }
  return "No se ha podido guardar la ficha. Inténtalo de nuevo.";
}

/**
 * "Confirmar" for one sheet. Mount it once per sheet: the confirm id is made on
 * mount and kept, so a retry (after a timeout that may have saved) never saves a
 * second copy, and a new sheet gets a new id.
 *
 * The client function is injected so tests can pass a fake.
 */
export function useConfirm(
  confirmFn: ConfirmFn,
  transcript: string,
  onSaved: (saved: SavedPreparation) => void,
) {
  const [confirmId] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState<ConfirmStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // `status` is for rendering; this ref blocks a second tap before the next render.
  const busy = useRef(false);
  // A result that arrives after the sheet is gone (a new recording) is dropped.
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const confirm = useCallback(
    async (sheet: Sheet) => {
      if (busy.current) return;
      busy.current = true;
      setStatus("pending");
      setError(null);
      try {
        const saved = await confirmFn({ confirmId, transcript, sheet });
        if (!mounted.current) return;
        // Stays busy: a saved sheet is not sent again.
        setStatus("saved");
        onSaved(saved);
      } catch (e) {
        busy.current = false;
        if (!mounted.current) return;
        setError(errorMessage(e));
        setStatus("error");
      }
    },
    [confirmFn, confirmId, transcript, onSaved],
  );

  return { status, error, confirm };
}
