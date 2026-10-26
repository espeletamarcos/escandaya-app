import { BrowserRecorder } from "./recorder/BrowserRecorder";
import RecordScreen from "./screens/RecordScreen";

const recorder = new BrowserRecorder();

function App() {
  return <RecordScreen recorder={recorder} />;
}

export default App;
