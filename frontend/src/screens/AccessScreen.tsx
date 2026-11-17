import { type SubmitEvent, useState } from "react";
import { parseTokenInput } from "../auth/token";
import ScreenTitle from "../ui/ScreenTitle";
import "./AccessScreen.css";

interface AccessScreenProps {
  /** Called with the token read from the pasted link or code. */
  onToken: (token: string) => void;
  /** The last pasted token was checked and rejected by the backend. */
  rejected?: boolean;
  /** A pasted token is being checked. */
  checking?: boolean;
}

function AccessScreen({ onToken, rejected = false, checking = false }: AccessScreenProps) {
  const [input, setInput] = useState("");
  const [unreadable, setUnreadable] = useState(false);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = parseTokenInput(input);
    if (token === null) {
      setUnreadable(true);
      return;
    }
    onToken(token);
  }

  const message = unreadable
    ? "No es un enlace ni un código válido"
    : rejected && !checking
      ? "Ese enlace no es válido"
      : null;

  return (
    <main className="access-screen">
      <ScreenTitle>Acceso privado</ScreenTitle>
      <p className="access-lead">Para usar Escandaya, abre la app desde tu enlace privado.</p>
      <form className="access-form" onSubmit={submit}>
        <label htmlFor="access-input">Enlace o código de acceso</label>
        <input
          id="access-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Pega aquí tu enlace"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setUnreadable(false);
          }}
        />
        <button type="submit" className="button-primary" disabled={checking}>
          {checking ? "Comprobando…" : "Entrar"}
        </button>
        {message && (
          <p role="alert" className="message-error">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}

export default AccessScreen;
