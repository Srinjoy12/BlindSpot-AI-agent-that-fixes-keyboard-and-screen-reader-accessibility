import React, { useState } from "react";
import { StatusIcon } from "./ui/StatusIcon.js";
import { Button } from "./ui/Button.js";

export type AuditPhase =
  | "idle"
  | "launch"
  | "crawl"
  | "interact"
  | "detect"
  | "digest"
  | "analyze"
  | "fix"
  | "complete"
  | "error";

interface PhaseStepperProps {
  currentPhase: AuditPhase;
  statusMessage: string;
  durationMs?: number;
  runFixes?: boolean;
}

interface StepDefinition {
  id: string;
  number: number;
  label: string;
  modelBadge?: "Nano" | "Super" | "Ultra";
}

const STEPS: StepDefinition[] = [
  { id: "crawl", number: 1, label: "Tab through the page" },
  { id: "interact", number: 2, label: "Try menus and dialogs" },
  { id: "detect", number: 3, label: "Check against known rules" },
  { id: "digest", number: 4, label: "Summarise each page state", modelBadge: "Nano" },
  { id: "analyze", number: 5, label: "Rank and explain the problems", modelBadge: "Super" },
  { id: "fix", number: 6, label: "Write and test fixes", modelBadge: "Ultra" },
];

export const PhaseStepper: React.FC<PhaseStepperProps> = ({
  currentPhase,
  statusMessage,
  durationMs = 0,
  runFixes = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (currentPhase === "idle") return null;

  const phaseOrder = ["launch", "crawl", "interact", "detect", "digest", "analyze", "fix", "complete"];
  const currentPhaseIndex = phaseOrder.indexOf(currentPhase);

  // Active step index (0-5)
  let activeStepIndex = -1;
  if (currentPhase === "launch" || currentPhase === "crawl") activeStepIndex = 0;
  else if (currentPhase === "interact") activeStepIndex = 1;
  else if (currentPhase === "detect") activeStepIndex = 2;
  else if (currentPhase === "digest") activeStepIndex = 3;
  else if (currentPhase === "analyze") activeStepIndex = 4;
  else if (currentPhase === "fix") activeStepIndex = 5;

  const activeStep = activeStepIndex >= 0 ? STEPS[activeStepIndex] : null;

  // Format duration in seconds
  const durationText =
    durationMs > 0
      ? `${(durationMs / 1000).toFixed(1)} s`
      : "0.0 s";

  // Compute live announcement
  let announcement = "";
  if (currentPhase === "complete") {
    announcement = `Audit complete: Finished in ${durationText}`;
  } else if (currentPhase === "error") {
    announcement = `Audit failed: ${statusMessage}`;
  } else if (activeStep) {
    announcement = `Step ${activeStep.number} of 6: ${activeStep.label}`;
  }

  // When finished: collapse the stepper to one line with "Show steps" toggle
  if (currentPhase === "complete" && !isExpanded) {
    return (
      <div
        className="neo-extruded"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "var(--color-accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              boxShadow: "0 0 10px rgba(27, 94, 59, 0.4)",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            ✓
          </div>
          <span
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Finished in {durationText}
          </span>
        </div>

        {/* Hidden screen-reader announcement */}
        <div aria-live="polite" className="visually-hidden">
          {announcement}
        </div>

        <Button
          variant="quiet"
          size="sm"
          onClick={() => setIsExpanded(true)}
          aria-expanded={false}
          title="Show individual audit pipeline steps"
        >
          Show steps
        </Button>
      </div>
    );
  }

  return (
    <div
      className="neo-extruded"
      style={{
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
      role="status"
    >
      {/* Screen reader announcement region */}
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      {/* Top Header: Progress text or Completed line with Hide steps */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {currentPhase === "complete" ? (
            <>
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-accent-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: "12px",
                }}
              >
                ✓
              </div>
              <span
                style={{
                  fontSize: "var(--font-size-base)",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                Finished in {durationText}
              </span>
            </>
          ) : currentPhase === "error" ? (
            <>
              <StatusIcon status="error" size={18} />
              <span
                style={{
                  fontSize: "var(--font-size-base)",
                  fontWeight: 600,
                  color: "var(--color-severity-blocker)",
                }}
              >
                Audit stopped
              </span>
            </>
          ) : (
            <span
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
              }}
            >
              {activeStep ? `Step ${activeStep.number} of 6: ${activeStep.label}` : "Running audit..."}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {statusMessage && currentPhase !== "complete" && (
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: currentPhase === "error" ? "var(--color-severity-blocker)" : "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {statusMessage}
            </span>
          )}

          {currentPhase === "complete" && (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setIsExpanded(false)}
              aria-expanded={true}
              title="Hide audit pipeline steps"
            >
              Hide steps
            </Button>
          )}
        </div>
      </div>

      {/* Recessed Inset Groove connecting steps */}
      <div
        className="neo-sunken stepper-grid"
        style={{
          padding: "var(--space-3)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        {STEPS.map((step) => {
          let stepStatus: "pending" | "running" | "done" | "skipped" | "error" = "pending";

          const isFixStep = step.id === "fix";
          const isFixSkipped = isFixStep && !runFixes;

          if (currentPhase === "complete") {
            stepStatus = isFixSkipped ? "skipped" : "done";
          } else if (currentPhase === "error") {
            const stepOrderIndex = phaseOrder.indexOf(step.id);
            if (currentPhaseIndex > stepOrderIndex) {
              stepStatus = "done";
            } else if (currentPhaseIndex === stepOrderIndex) {
              stepStatus = "error";
            } else {
              stepStatus = "pending";
            }
          } else {
            const stepOrderIndex = phaseOrder.indexOf(step.id);
            if (currentPhaseIndex > stepOrderIndex) {
              stepStatus = "done";
            } else if (currentPhaseIndex === stepOrderIndex) {
              stepStatus = isFixSkipped ? "skipped" : "running";
            } else {
              stepStatus = isFixSkipped ? "skipped" : "pending";
            }
          }

          const isRunningStep = stepStatus === "running";
          const isDoneStep = stepStatus === "done";
          const isSkippedStep = stepStatus === "skipped";

          return (
            <div
              key={step.id}
              className={isRunningStep ? "neo-extruded" : ""}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                backgroundColor: isRunningStep
                  ? "var(--neo-extruded-bg)"
                  : isDoneStep
                  ? "transparent"
                  : "transparent",
                boxShadow: isRunningStep
                  ? "var(--neo-extruded-shadow)"
                  : "none",
                border: isRunningStep
                  ? "1px solid var(--color-accent-secondary)"
                  : isDoneStep
                  ? "1px solid var(--color-border-subdued)"
                  : "1px dashed var(--color-border-subdued)",
                transition: "all var(--transition-duration) var(--transition-timing)",
              }}
            >
              {/* Step Bead + Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {/* Step Circular Bead */}
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      flexShrink: 0,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      backgroundColor: isDoneStep
                        ? "var(--color-accent-primary)"
                        : isRunningStep
                        ? "var(--color-accent-secondary)"
                        : "var(--neo-sunken-bg)",
                      color: isDoneStep
                        ? "#FFFFFF"
                        : isRunningStep
                        ? "#FFFFFF"
                        : "var(--color-text-muted)",
                      boxShadow: isRunningStep
                        ? "0 0 10px var(--color-accent-secondary)"
                        : isDoneStep
                        ? "0 0 6px rgba(27, 94, 59, 0.4)"
                        : "inset 1px 1px 3px rgba(0,0,0,0.4)",
                      border: isRunningStep ? "2px solid #FFFFFF" : isDoneStep ? "1px solid var(--color-status-success)" : "1px solid var(--color-border-ui)",
                    }}
                  >
                    {isDoneStep ? "✓" : step.number}
                  </div>
                  <span
                    style={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      color: isRunningStep
                        ? "var(--color-text-primary)"
                        : isDoneStep
                        ? "var(--color-text-primary)"
                        : "var(--color-text-muted)",
                    }}
                  >
                    Step {step.number}
                  </span>
                </div>

                {/* Model Badge */}
                {step.modelBadge && (
                  <span
                    className="neo-pill"
                    style={{
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      padding: "1px 6px",
                      backgroundColor: isRunningStep ? "var(--color-accent-primary)" : "var(--color-surface-3)",
                      color: isRunningStep ? "#FFFFFF" : "var(--color-text-secondary)",
                      border: "1px solid var(--color-border-subdued)",
                    }}
                  >
                    {step.modelBadge}
                  </span>
                )}
              </div>

              {/* Step Plain-English Label */}
              <div
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: isRunningStep
                    ? "var(--color-text-primary)"
                    : isDoneStep
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-muted)",
                  fontWeight: isRunningStep ? 600 : 400,
                  lineHeight: 1.4,
                }}
              >
                {step.label}
              </div>

              {/* Status Pill or Skipped text */}
              <div style={{ marginTop: "auto" }}>
                {isSkippedStep ? (
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
                    Skipped (fixes off)
                  </span>
                ) : isRunningStep ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "var(--color-accent-secondary)",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: "var(--color-accent-secondary)",
                        animation: "pulse 1.2s infinite",
                      }}
                    />
                    Running...
                  </span>
                ) : isDoneStep ? (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--color-status-success)",
                      fontWeight: 600,
                    }}
                  >
                    Completed
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
