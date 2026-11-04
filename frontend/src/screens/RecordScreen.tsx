import { transcribe as transcribeAudio } from "../api/client";
import type { Recorder } from "../recorder/Recorder";
import { formatDuration, MAX_RECORDING_MS, useRecorder } from "../recorder/useRecorder";
import { useTranscription, type TranscribeFn } from "../transcription/useTranscription";
import "./RecordScreen.css";

interface RecordScreenProps {
  recorder: Recorder;
  /** Sends the audio for transcription; tests pass a fake. */
  transcribe?: TranscribeFn;
}

function RecordScreen({ recorder, transcribe = transcribeAudio }: RecordScreenProps) {
  const { status, audio, audioUrl, error, notice, elapsed, toggle } = useRecorder(recorder);
  const transcription = useTranscription(transcribe);
  const recording = status === "recording";
  const pending = transcription.status === "pending";

  const onRecordClick = () => {
    // A new recording replaces the old one, so its transcript no longer applies.
    if (!recording) transcription.reset();
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
        {recording ? "Stop" : "Record"}
      </button>
      {recording && (
        <>
          <p>Recording…</p>
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
        <section className="transcription" aria-live="polite">
          <button
            type="button"
            className="transcribe-button"
            disabled={pending}
            onClick={() => void transcription.transcribe(audio)}
          >
            Transcribir
          </button>
          {pending && <p>Transcribiendo…</p>}
          {transcription.error && <p role="alert">{transcription.error}</p>}
          {transcription.status === "done" &&
            (transcription.text?.trim() ? (
              <p className="transcript">{transcription.text}</p>
            ) : (
              <p className="transcript-empty">No se ha detectado voz</p>
            ))}
        </section>
      )}
    </main>
  );
}

export default RecordScreen;
