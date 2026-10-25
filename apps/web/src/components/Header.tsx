import React from "react";

export const Header: React.FC = () => {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        height: "50px",
        borderBottom: "1px solid var(--color-border-subdued)",
        backgroundColor: "var(--color-surface-1)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
      role="banner"
    >
      {/* Left: Brand & Engine Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--color-text-primary)",
          }}
        >
          BlindSpot
        </span>
        <span
          className="header-tag"
          style={{
            fontSize: "10px",
            fontWeight: 600,
            padding: "2px 5px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--color-surface-2)",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-subdued)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
          }}
        >
          NEBIUS × NVIDIA
        </span>

        <span className="header-desc" style={{ color: "var(--color-border-strong)", fontSize: "12px" }}>
          /
        </span>

        <span
          className="header-desc"
          style={{
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}
        >
          Accessibility Intelligence Engine
        </span>
      </div>

      {/* Right: Technical Telemetry Status */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent-emerald)",
              display: "inline-block",
            }}
            aria-hidden="true"
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
            Nemotron-3
          </span>
        </div>

        <div
          className="header-meta"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "2px 7px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-muted)",
          }}
        >
          <span>Deterministic Chromium</span>
        </div>
      </div>
    </header>
  );
};
