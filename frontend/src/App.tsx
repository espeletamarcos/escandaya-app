import { useEffect, useState } from "react";
import { getHealth } from "./api/client";

function App() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return <h1>Backend: {status}</h1>;
}

export default App;