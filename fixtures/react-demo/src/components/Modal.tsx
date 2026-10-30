import React from "react";

export function SettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="settings-modal" role="dialog" aria-modal="true">
      <h2>Account Settings</h2>
      <button className="submit-action" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
