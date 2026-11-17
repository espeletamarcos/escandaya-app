import { listPreparations as listRequest } from "../api/client";
import { coversText, formatDate, missingText } from "../preparations/format";
import type { PreparationSummary } from "../preparations/types";
import { useLoad } from "../preparations/useLoad";
import { CheckIcon } from "../ui/icons";
import ScreenTitle from "../ui/ScreenTitle";
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

  const count = list.status === "done" ? list.data.length : 0;

  return (
    <main className="preparations-screen">
      <header className="preparations-header">
        <ScreenTitle>Preparaciones</ScreenTitle>
        {count > 0 && (
          <p className="preparations-count">{count === 1 ? "1 ficha" : `${count} fichas`}</p>
        )}
      </header>
      {notice && (
        <p role="status" className="preparations-notice">
          <CheckIcon />
          {notice}
        </p>
      )}
      {list.status === "loading" && <p className="screen-status panel">Cargando…</p>}
      {list.status === "error" && (
        <div className="screen-problem panel">
          <p role="alert" className="message-error">
            {list.error}
          </p>
          <button type="button" className="button-quiet" onClick={list.retry}>
            Reintentar
          </button>
        </div>
      )}
      {list.status === "done" && list.data.length === 0 && (
        <div className="preparations-empty panel">
          <p className="preparations-empty-title">Aún no hay preparaciones</p>
          <p>Graba la primera en «Nueva ficha».</p>
        </div>
      )}
      {list.status === "done" && list.data.length > 0 && (
        <ul className="preparation-list panel" aria-label="Preparaciones guardadas">
          {list.data.map((item) => (
            <li key={item.id}>
              <button type="button" className="preparation-item" onClick={() => onOpen(item.id)}>
                <span className="preparation-name">{item.name}</span>
                <span className="preparation-meta">
                  <span className={item.covers === null ? "preparation-missing" : undefined}>
                    {coversText(item.covers)}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <time dateTime={item.confirmed_at}>{formatDate(item.confirmed_at)}</time>
                  <span aria-hidden="true"> · </span>
                  <span className={item.missing_count > 0 ? "preparation-missing" : undefined}>
                    {missingText(item.missing_count)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default PreparationsScreen;
