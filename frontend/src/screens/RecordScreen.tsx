import { useEffect, useRef } from "react";
import {
  confirmPreparation as confirmRequest,
  createDraft as createDraftRequest,
  transcribe as transcribeAudio,
} from "../api/client";
import type { SavedPreparation } from "../preparations/types";
import { type ConfirmFn, useConfirm } from "../preparations/useConfirm";
import type { Recorder } from "../recorder/Recorder";
import { formatDuration, MAX_RECORDING_MS, useRecorder } from "../recorder/useRecorder";
import SheetForm from "../sheet/SheetForm";
import type { Sheet } from "../sheet/types";
import { type CreateDraftFn, type TranscribeFn, useVoiceSheet } from "../sheet/useVoiceSheet";
import ScreenTitle from "../ui/ScreenTitle";
import { CheckIcon, MicrophoneIcon } from "../ui/icons";
import "./RecordScreen.css";

interface DraftSheetProps {
  sheet: Sheet;
  transcript: string;
  confirmPreparation: ConfirmFn;
  onSaved: (saved: SavedPreparation) => void;
}

/**
 * One sheet with its "Confirmar". Keyed by the draft, so each new sheet mounts a
 * new `useConfirm` and gets a new confirm id.
 */
function DraftSheet({ sheet, transcript, confirmPreparation, onSaved }: DraftSheetProps) {
  const { status, error, confirm } = useConfirm(confirmPreparation, transcript, onSaved);
  return (
    <SheetForm
      sheet={sheet}
      onConfirm={(edited) => void confirm(edited)}
      confirming={status === "pending" || status === "saved"}
      confirmError={error}
    />
  );
}

const ignoreSaved = () => {};

interface RecordScreenProps {
  recorder: Recorder;
  /** Send the audio for transcription, the text for a sheet, and the sheet to save; tests pass fakes. */
  transcribe?: TranscribeFn;
  createDraft?: CreateDraftFn;
  confirmPreparation?: ConfirmFn;
  /** After a sheet is saved. */
  onSaved?: (saved: SavedPreparation) => void;
}

function RecordScreen({
  recorder,
  transcribe = transcribeAudio,
  createDraft = createDraftRequest,
  confirmPreparation = confirmRequest,
  onSaved = ignoreSaved,
}: RecordScreenProps) {
  const { status, audio, audioUrl, error, notice, elapsed, toggle } = useRecorder(recorder);
  const voice = useVoiceSheet(transcribe, createDraft);
  const recording = status === "recording";
  const pending = voice.step === "transcribing" || voice.step === "structuring";
  // Each recording gets one sheet; another try would not change the outcome.
  // After an error the button is enabled again, to retry the step that failed.
  const finished =
    voice.step === "done" || voice.step === "no-voice" || voice.step === "not-preparation";

  const onRecordClick = () => {
    // A new recording replaces the old one, with its transcript and its sheet.
    if (!recording) voice.reset();
    void toggle();
  };

  const showSheet = voice.step === "done" && voice.sheet !== null && voice.transcript !== null;
  const steps = recording ? 0 : voice.step === "transcribing" ? 1 : voice.step === "structuring" ? 2 : null;

  // The sheet replaces the recording controls, and back: the focused button goes away
  // with them. Give the focus a place to land, the sheet's name or the record button.
  const main = useRef<HTMLElement>(null);
  const sheetShown = useRef(false);
  useEffect(() => {
    if (sheetShown.current === showSheet) return;
    sheetShown.current = showSheet;
    if (document.activeElement !== document.body) return;
    const target = showSheet ? '[data-line="name"]' : ".record-button";
    main.current?.querySelector<HTMLElement>(target)?.focus();
  }, [showSheet]);

  const recordButton = (
    <button
      type="button"
      className={[
        "record-button",
        recording && "recording",
        audio && !recording && "again",
        showSheet && "compact",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={recording}
      onClick={onRecordClick}
    >
      {recording ? (
        <>
          <span className="record-stop" aria-hidden="true" />
          <span className="visually-hidden">Parar</span>
        </>
      ) : (
        <>
          <MicrophoneIcon size={showSheet ? 24 : 44} />
          Grabar
        </>
      )}
    </button>
  );

  const transcribeButton = audio && !recording && (
    <button
      type="button"
      className={showSheet ? "voice-sheet-button button-quiet" : "voice-sheet-button button-primary"}
      disabled={pending || finished}
      onClick={() => void voice.run(audio)}
    >
      {/* Under the sheet the step is done: the check says so. */}
      {showSheet && <CheckIcon />}
      Transcribir y crear ficha
    </button>
  );

  const messages = (
    <>
      {error && (
        <p role="alert" className="message-error record-message">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="record-notice">
          {notice}
        </p>
      )}
      {voice.error && (
        <p role="alert" className="message-error record-message">
          {voice.error}
        </p>
      )}
      {voice.step === "no-voice" && (
        <div role="status" className="voice-sheet-notice panel">
          <p className="voice-sheet-notice-title">No se ha detectado voz</p>
          <p>Graba de nuevo, más cerca del micrófono.</p>
        </div>
      )}
      {voice.step === "not-preparation" && (
        <div role="status" className="voice-sheet-notice panel">
          <p className="voice-sheet-notice-title">No parece una preparación</p>
          <p>Graba de nuevo con el nombre, cuánto sale y qué lleva.</p>
        </div>
      )}
    </>
  );

  // With a sheet on screen, the sheet comes first: it is what the chef checks. The
  // recording stays below it, to listen to it again or record a new one.
  if (showSheet && voice.sheet && voice.transcript !== null) {
    return (
      <main ref={main} className="record-screen with-sheet">
        <DraftSheet
          key={voice.draftId}
          sheet={voice.sheet}
          transcript={voice.transcript}
          confirmPreparation={confirmPreparation}
          onSaved={onSaved}
        />
        <section className="record-again panel" aria-labelledby="record-again-title">
          <h2 id="record-again-title" className="record-again-title">
            Grabación
          </h2>
          {audioUrl && <audio controls src={audioUrl} />}
          <p className="record-again-hint">Si grabas de nuevo, esta ficha se descarta.</p>
          <div className="record-again-actions">
            {recordButton}
            {transcribeButton}
          </div>
        </section>
        {messages}
      </main>
    );
  }

  return (
    <main ref={main} className="record-screen">
      <ScreenTitle>Nueva ficha</ScreenTitle>
      <section className="record-stage">
        {recording && (
          <div className="record-live">
            <p className="record-live-label">
              <span className="record-dot" aria-hidden="true" />
              Grabando
            </p>
            <p role="timer" className="record-timer">
              {formatDuration(elapsed)}
              <span className="record-timer-limit"> / {formatDuration(MAX_RECORDING_MS / 1000)}</span>
            </p>
          </div>
        )}
        {recordButton}
        {!audio && messages}
        {!audio && (
          <div className="record-hints">
            <p className="record-hint">Di el nombre, cuánto sale, para cuántas raciones y qué lleva.</p>
            {!recording && (
              <p className="record-example">
                Por ejemplo: «Hago dos kilos de tartar de atún para unas cuarenta raciones…»
              </p>
            )}
          </div>
        )}
        {audioUrl && !recording && <audio controls src={audioUrl} />}
        {audio && messages}
        {transcribeButton}
      </section>
      {/* Announces each step; the timer stays out of it, or it would be read every second. */}
      <div aria-live="polite">{steps !== null && <Steps current={steps} />}</div>
    </main>
  );
}

const STEPS = [
  { label: "Grabar", now: "Grabando…" },
  { label: "Transcribir", now: "Transcribiendo…" },
  { label: "Crear ficha", now: "Creando ficha…" },
];

/** Where the voice note is: recording, transcribing, or creating the sheet. */
function Steps({ current }: { current: number }) {
  return (
    <ol className="record-steps panel" aria-label="Pasos">
      {STEPS.map((step, index) => {
        const state = index < current ? "done" : index === current ? "now" : "next";
        return (
          <li key={step.label} className={`record-step ${state}`}>
            <span className="record-step-mark" aria-hidden="true" />
            {state === "now" ? step.now : step.label}
            {state === "now" && <span className="record-step-state">Ahora</span>}
            {state === "done" && <span className="visually-hidden">(hecho)</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default RecordScreen;
