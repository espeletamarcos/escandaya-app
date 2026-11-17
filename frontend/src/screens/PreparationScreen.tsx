import { getPreparation as getRequest } from "../api/client";
import type { SavedPreparation } from "../preparations/types";
import { useLoad } from "../preparations/useLoad";
import SheetView from "../sheet/SheetView";
import { BackIcon } from "../ui/icons";
import "./PreparationScreen.css";

const FAILED = "No se ha podido cargar la preparación. Inténtalo de nuevo.";

interface PreparationScreenProps {
  id: number;
  /** Tests pass a fake. */
  getPreparation?: (id: number) => Promise<SavedPreparation>;
  onBack: () => void;
}

/** One saved preparation, read-only. Editing a confirmed sheet is out of scope. */
function PreparationScreen({ id, getPreparation = getRequest, onBack }: PreparationScreenProps) {
  const preparation = useLoad(() => getPreparation(id), FAILED);

  return (
    <main className="preparation-screen">
      <div className="preparation-back-row">
        <button type="button" className="button-quiet preparation-back" onClick={onBack}>
          <BackIcon />
          <span className="visually-hidden">Volver a</span> Preparaciones
        </button>
      </div>
      {preparation.status === "loading" && <p className="screen-status">Cargando…</p>}
      {preparation.status === "error" && (
        <div className="screen-problem panel">
          <p role="alert" className="message-error">
            {preparation.error}
          </p>
          <button type="button" className="button-quiet" onClick={preparation.retry}>
            Reintentar
          </button>
        </div>
      )}
      {preparation.status === "done" && (
        <SheetView
          sheet={preparation.data.sheet}
          missing={preparation.data.missing}
          confirmedAt={preparation.data.confirmed_at}
        />
      )}
    </main>
  );
}

export default PreparationScreen;
