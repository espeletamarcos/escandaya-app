import ScreenTitle from "../ui/ScreenTitle";
import "./AccessScreen.css";

/** Shown while the stored token is being checked, so no other screen flashes first. */
export function CheckingScreen() {
  return (
    <main className="access-screen">
      <ScreenTitle>Escandaya</ScreenTitle>
      <p role="status" className="access-lead">
        Comprobando acceso…
      </p>
    </main>
  );
}

/** The check could not finish (no signal, server error): the token may still be valid. */
export function UnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="access-screen">
      <ScreenTitle>Escandaya</ScreenTitle>
      <p role="alert" className="access-problem">
        No se ha podido comprobar el acceso
      </p>
      <p className="access-lead">Revisa la conexión e inténtalo de nuevo.</p>
      <button type="button" className="button-primary" onClick={onRetry}>
        Reintentar
      </button>
    </main>
  );
}
