import type { Recorder } from "../recorder/Recorder";
import { useRecorder } from "../recorder/useRecorder";
import "./RecordScreen.css";

interface RecordScreenProps {
  recorder: Recorder;
}

function RecordScreen({ recorder }: RecordScreenProps) {
  const { status, audioUrl, error, toggle } = useRecorder(recorder);
  const recording = status === "recording";

  return (
    <main className="record-screen">
      <button
        type="button"
        className={recording ? "record-button recording" : "record-button"}
        aria-pressed={recording}
        onClick={() => void toggle()}
      >
        {recording ? "Stop" : "Record"}
      </button>
      {recording && <p>Recording…</p>}
      {error && <p role="alert">{error}</p>}
      {audioUrl && <audio controls src={audioUrl} />}
    </main>
  );
}

export default RecordScreen;
