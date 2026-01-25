import { useState } from "react";
import GlobeView from "./components/GlobeView";
import Topbar from "./components/topbar";

export default function App() {
  const [q, setQ] = useState("");

  return (
    <>
      <GlobeView />
      <Topbar value={q} onChange={setQ} />
    </>
  );
}
