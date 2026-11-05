import "./AccessScreen.css";

/** Shown while the stored token is being checked, so no other screen flashes first. */
export function CheckingScreen() {
  return (
    <main className="access-screen">
      <p role="status">Comprobando acceso…</p>
    </main>
  );
}

/** The check could not finish (no signal, server error): the token may still be valid. */
export function UnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="access-screen">
      <p role="alert">No se ha podido comprobar el acceso</p>
      <p>Revisa la conexión e inténtalo de nuevo.</p>
      <button type="button" onClick={onRetry}>
        Reintentar
      </button>
    </main>
  );
}
