import { useCallback, useEffect, useRef, useState } from "react";
import { checkSession, onUnauthorized } from "./api/client";
import { setToken } from "./auth/token";
import { BrowserRecorder } from "./recorder/BrowserRecorder";
import type { Recorder } from "./recorder/Recorder";
import AccessScreen from "./screens/AccessScreen";
import RecordScreen from "./screens/RecordScreen";
import { CheckingScreen, UnavailableScreen } from "./screens/SessionStatus";

/** The part of the API client the gate uses; tests pass a fake. */
export interface SessionClient {
  checkSession: () => Promise<boolean>;
  onUnauthorized: (listener: () => void) => () => void;
}

const defaultSession: SessionClient = { checkSession, onUnauthorized };
const defaultRecorder = new BrowserRecorder();

type Gate =
  | { kind: "checking" }
  | { kind: "locked"; rejected: boolean; checking: boolean }
  | { kind: "unlocked" }
  | { kind: "unavailable" };

function locked({ rejected = false, checking = false } = {}): Gate {
  return { kind: "locked", rejected, checking };
}

interface AppProps {
  session?: SessionClient;
  recorder?: Recorder;
}

function App({ session = defaultSession, recorder = defaultRecorder }: AppProps) {
  const [gate, setGate] = useState<Gate>({ kind: "checking" });
  // Only the latest check may decide; StrictMode runs the first one twice in development.
  const latestCheck = useRef(0);

  const runCheck = useCallback(
    async (afterPaste: boolean) => {
      const id = ++latestCheck.current;
      let next: Gate;
      try {
        const valid = await session.checkSession();
        next = valid ? { kind: "unlocked" } : locked({ rejected: afterPaste });
      } catch {
        next = { kind: "unavailable" };
      }
      if (id === latestCheck.current) {
        setGate(next);
      }
    },
    [session],
  );

  useEffect(() => {
    void runCheck(false);
  }, [runCheck]);

  // Any 401 (for example, a token revoked while the app is open) locks the app.
  useEffect(() => session.onUnauthorized(() => setGate(locked())), [session]);

  function handleToken(token: string) {
    setToken(token);
    setGate(locked({ checking: true }));
    void runCheck(true);
  }

  function retry() {
    setGate({ kind: "checking" });
    void runCheck(false);
  }

  switch (gate.kind) {
    case "checking":
      return <CheckingScreen />;
    case "unavailable":
      return <UnavailableScreen onRetry={retry} />;
    case "locked":
      return (
        <AccessScreen onToken={handleToken} rejected={gate.rejected} checking={gate.checking} />
      );
    case "unlocked":
      return <RecordScreen recorder={recorder} />;
  }
}

export default App;
