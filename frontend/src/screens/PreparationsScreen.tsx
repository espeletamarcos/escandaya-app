import { listPreparations as listRequest } from "../api/client";
import { coversText, formatDate, missingText } from "../preparations/format";
import type { PreparationSummary } from "../preparations/types";
import { useLoad } from "../preparations/useLoad";
import "./PreparationsScreen.css";

const FAILED = "No se han podido cargar las preparaciones. Inténtalo de nuevo.";

interface PreparationsScreenProps {
  /** Tests pass a fake. */
  listPreparations?: () => Promise<PreparationSummary[]>;
  onOpen: (id: number) => void;
  /** Shown above the list, such as "Ficha guardada" after a confirm. */
  notice?: string | null;
}

/** The saved preparations, newest first. Loaded each time the screen opens. */
function PreparationsScreen({
  listPreparations = listRequest,
  onOpen,
  notice = null,
}: PreparationsScreenProps) {
  const list = useLoad(listPreparations, FAILED);

  return (
    <main className="preparations-screen">
      <h1>Preparaciones</h1>
      {notice && <p role="status">{notice}</p>}
      {list.status === "loading" && <p>Cargando…</p>}
      {list.status === "error" && (
        <>
          <p role="alert">{list.error}</p>
          <button type="button" onClick={list.retry}>
            Reintentar
          </button>
        </>
      )}
      {list.status === "done" && list.data.length === 0 && <p>Aún no hay preparaciones</p>}
      {list.status === "done" && list.data.length > 0 && (
        <ul className="preparation-list" aria-label="Preparaciones guardadas">
          {list.data.map((item) => (
            <li key={item.id}>
              <button type="button" className="preparation-item" onClick={() => onOpen(item.id)}>
                <span className="preparation-name">{item.name}</span>
                <span>{coversText(item.covers)}</span>
                <span>{missingText(item.missing_count)}</span>
                <time dateTime={item.confirmed_at}>{formatDate(item.confirmed_at)}</time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default PreparationsScreen;
