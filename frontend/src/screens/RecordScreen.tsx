import { createDraft as createDraftRequest, transcribe as transcribeAudio } from "../api/client";
import type { Recorder } from "../recorder/Recorder";
import { formatDuration, MAX_RECORDING_MS, useRecorder } from "../recorder/useRecorder";
import SheetForm from "../sheet/SheetForm";
import { type CreateDraftFn, type TranscribeFn, useVoiceSheet } from "../sheet/useVoiceSheet";
import "./RecordScreen.css";

interface RecordScreenProps {
  recorder: Recorder;
  /** Send the audio for transcription and the text for a sheet; tests pass fakes. */
  transcribe?: TranscribeFn;
  createDraft?: CreateDraftFn;
}

function RecordScreen({
  recorder,
  transcribe = transcribeAudio,
  createDraft = createDraftRequest,
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

  return (
    <main className="record-screen">
      <button
        type="button"
        className={recording ? "record-button recording" : "record-button"}
        aria-pressed={recording}
        onClick={onRecordClick}
      >
        {recording ? "Parar" : "Grabar"}
      </button>
      {recording && (
        <>
          <p>Grabando…</p>
          <p role="timer" className="record-timer">
            {formatDuration(elapsed)} / {formatDuration(MAX_RECORDING_MS / 1000)}
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {audioUrl && <audio controls src={audioUrl} />}
      {notice && (
        <p role="status" className="record-notice">
          {notice}
        </p>
      )}
      {audio && !recording && (
        <section className="voice-sheet" aria-live="polite">
          <button
            type="button"
            className="voice-sheet-button"
            disabled={pending || finished}
            onClick={() => void voice.run(audio)}
          >
            Transcribir y crear ficha
          </button>
          {voice.step === "transcribing" && <p>Transcribiendo…</p>}
          {voice.step === "structuring" && <p>Creando ficha…</p>}
          {voice.error && <p role="alert">{voice.error}</p>}
          {voice.step === "no-voice" && (
            <p className="voice-sheet-notice">No se ha detectado voz</p>
          )}
          {voice.step === "not-preparation" && (
            <p className="voice-sheet-notice">No parece una preparación</p>
          )}
          {/* The transcript is never shown: the chef sees the sheet (04-C5). */}
          {voice.step === "done" && voice.sheet && (
            <SheetForm key={voice.draftId} sheet={voice.sheet} />
          )}
        </section>
      )}
    </main>
  );
}

export default RecordScreen;
