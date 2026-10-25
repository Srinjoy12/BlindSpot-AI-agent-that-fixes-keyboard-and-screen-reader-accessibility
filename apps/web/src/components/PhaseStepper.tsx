import React from "react";

export type AuditPhase = "idle" | "launch" | "crawl" | "interact" | "detect" | "digest" | "analyze" | "fix" | "complete" | "error";

interface PhaseStepperProps {
  currentPhase: AuditPhase;
  statusMessage: string;
}

const PHASES = [
  { id: "crawl", step: "01", label: "Keyboard Crawl" },
  { id: "interact", step: "02", label: "Interaction Probe" },
  { id: "detect", step: "03", label: "Deterministic Rules" },
  { id: "digest", step: "04", label: "Nano Digest" },
  { id: "analyze", step: "05", label: "Super WCAG" },
  { id: "fix", step: "06", label: "Ultra Fix & Verify" },
];

export const PhaseStepper: React.FC<PhaseStepperProps> = ({ currentPhase, statusMessage }) => {
  if (currentPhase === "idle") return null;

  const getPhaseStatus = (phaseId: string) => {
    if (currentPhase === "complete") return "done";
    if (currentPhase === "error") return "error";

    const order = ["launch", "crawl", "interact", "detect", "digest", "analyze", "fix", "complete"];
    const currentIndex = order.indexOf(currentPhase);
    const targetIndex = order.indexOf(phaseId);

    if (currentIndex > targetIndex) return "done";
    if (currentIndex === targetIndex) return "active";
    return "pending";
  };

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 18px",
        marginBottom: "20px",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "12px",
          paddingBottom: "10px",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Pipeline Execution
        </span>
        <span
          style={{
            fontSize: "12px",
            color: currentPhase === "error" ? "var(--color-severity-blocker)" : "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {statusMessage}
        </span>
      </div>

      <div
        className="stepper-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "4px",
        }}
      >
        {PHASES.map((p) => {
          const status = getPhaseStatus(p.id);
          const isDone = status === "done";
          const isActive = status === "active";

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                padding: "8px 10px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: isActive
                  ? "var(--color-surface-3)"
                  : isDone
                  ? "var(--color-surface-2)"
                  : "transparent",
                border: isActive
                  ? "1px solid var(--color-border-focus)"
                  : isDone
                  ? "1px solid var(--color-border-subdued)"
                  : "1px solid transparent",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  color: isActive
                    ? "var(--color-border-focus)"
                    : isDone
                    ? "var(--color-accent-emerald)"
                    : "var(--color-text-muted)",
                }}
              >
                <span>{p.step}</span>
                <span>{isDone ? "✓" : isActive ? "●" : "○"}</span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive
                    ? "var(--color-text-primary)"
                    : isDone
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
