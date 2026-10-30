import React, { useState } from "react";
import { SettingsModal } from "./components/Modal.js";
import { SubmitButton } from "./components/Button.js";
import "./styles/buttons.css";

export function App() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main>
      <h1>React Demo Application</h1>
      <button onClick={() => setModalOpen(true)}>Open Settings</button>
      <SubmitButton label="Submit Feedback" />
      <SettingsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  );
}
