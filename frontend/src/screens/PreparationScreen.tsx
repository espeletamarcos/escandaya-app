import { getPreparation as getRequest } from "../api/client";
import { formatDate } from "../preparations/format";
import type { SavedPreparation } from "../preparations/types";
import { useLoad } from "../preparations/useLoad";
import SheetView from "../sheet/SheetView";
import "./PreparationsScreen.css";

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
    <main className="preparations-screen">
      <button type="button" className="preparation-back" onClick={onBack}>
        Volver
      </button>
      {preparation.status === "loading" && <p>Cargando…</p>}
      {preparation.status === "error" && (
        <>
          <p role="alert">{preparation.error}</p>
          <button type="button" onClick={preparation.retry}>
            Reintentar
          </button>
        </>
      )}
      {preparation.status === "done" && (
        <>
          <SheetView sheet={preparation.data.sheet} missing={preparation.data.missing} />
          <p>Confirmada el {formatDate(preparation.data.confirmed_at)}</p>
        </>
      )}
    </main>
  );
}

export default PreparationScreen;
