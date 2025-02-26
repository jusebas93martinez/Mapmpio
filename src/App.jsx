// src/App.jsx
import { useState } from "react";
import Mapa from "./components/Mapa";
import Dashboard from "./components/Dashboard";
import "./index.css";

function App() {
  const [selectedFeature, setSelectedFeature] = useState(null);

  return (
    <div className="container">
      <Mapa setSelectedFeature={setSelectedFeature} />
      <Dashboard feature={selectedFeature} />
    </div>
  );
}

export default App;
