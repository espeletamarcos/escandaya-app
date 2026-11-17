import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkSession,
  confirmPreparation,
  createDraft,
  getPreparation,
  listPreparations,
  onUnauthorized,
  transcribe,
} from "./api/client";
import { setToken } from "./auth/token";
import type { PreparationSummary, SavedPreparation } from "./preparations/types";
import type { ConfirmFn } from "./preparations/useConfirm";
import { BrowserRecorder } from "./recorder/BrowserRecorder";
import type { Recorder } from "./recorder/Recorder";
import AccessScreen from "./screens/AccessScreen";
import PreparationScreen from "./screens/PreparationScreen";
import PreparationsScreen from "./screens/PreparationsScreen";
import RecordScreen from "./screens/RecordScreen";
import { CheckingScreen, UnavailableScreen } from "./screens/SessionStatus";
import type { CreateDraftFn, TranscribeFn } from "./sheet/useVoiceSheet";
import { ListIcon, MicrophoneIcon } from "./ui/icons";
import "./App.css";

/** The part of the API client the gate uses; tests pass a fake. */
export interface SessionClient {
  checkSession: () => Promise<boolean>;
  onUnauthorized: (listener: () => void) => () => void;
}

/** The calls the unlocked screens make; tests pass fakes. */
export interface AppApi {
  transcribe: TranscribeFn;
  createDraft: CreateDraftFn;
  confirmPreparation: ConfirmFn;
  listPreparations: () => Promise<PreparationSummary[]>;
  getPreparation: (id: number) => Promise<SavedPreparation>;
}

const defaultSession: SessionClient = { checkSession, onUnauthorized };
const defaultRecorder = new BrowserRecorder();
const defaultApi: AppApi = {
  transcribe,
  createDraft,
  confirmPreparation,
  listPreparations,
  getPreparation,
};

type View = { kind: "record" } | { kind: "list" } | { kind: "detail"; id: number };

/**
 * The app once the token is accepted: the record screen, the list and one
 * preparation. No URL routing: three views, switched by the two tabs of the
 * bottom bar.
 */
function Unlocked({ recorder, api }: { recorder: Recorder; api: AppApi }) {
  const [view, setView] = useState<View>({ kind: "record" });
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped after a save: a new RecordScreen starts clean (no recording, no sheet).
  const [recordKey, setRecordKey] = useState(0);

  const go = (next: View) => {
    setNotice(null);
    setView(next);
  };

  const onSaved = useCallback(() => {
    setRecordKey((key) => key + 1);
    setNotice("Ficha guardada");
    setView({ kind: "list" });
  }, []);

  const onRecord = view.kind === "record";

  return (
    <>
      <div className="app-content">
        {/* Hidden, not removed, so an unconfirmed sheet survives a look at the list. */}
        <div hidden={!onRecord}>
          <RecordScreen
            key={recordKey}
            recorder={recorder}
            transcribe={api.transcribe}
            createDraft={api.createDraft}
            confirmPreparation={api.confirmPreparation}
            onSaved={onSaved}
          />
        </div>
        {view.kind === "list" && (
          <PreparationsScreen
            listPreparations={api.listPreparations}
            notice={notice}
            onOpen={(id) => go({ kind: "detail", id })}
          />
        )}
        {view.kind === "detail" && (
          <PreparationScreen
            key={view.id}
            id={view.id}
            getPreparation={api.getPreparation}
            onBack={() => go({ kind: "list" })}
          />
        )}
      </div>

      {/* After the content, so the focus order follows the screen: the bar is at the bottom. */}
      <nav className="tab-bar" aria-label="Secciones">
        <button
          type="button"
          className="tab"
          aria-current={onRecord ? "page" : undefined}
          onClick={() => go({ kind: "record" })}
        >
          <span className="tab-icon">
            <MicrophoneIcon />
          </span>
          Nueva ficha
        </button>
        <button
          type="button"
          className="tab"
          aria-current={onRecord ? undefined : "page"}
          onClick={() => go({ kind: "list" })}
        >
          <span className="tab-icon">
            <ListIcon />
          </span>
          Preparaciones
        </button>
      </nav>
    </>
  );
}

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
  api?: AppApi;
}

function App({ session = defaultSession, recorder = defaultRecorder, api = defaultApi }: AppProps) {
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
      return <Unlocked recorder={recorder} api={api} />;
  }
}

export default App;
