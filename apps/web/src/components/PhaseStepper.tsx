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

  // Format duration in seconds (e.g. "58.8 s" or "5.2 s")
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

  // When finished: collapse the stepper to one line: "Finished in 58.8 s" with a "Show steps" toggle
  if (currentPhase === "complete" && !isExpanded) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <StatusIcon status="success" size={16} />
          <span
            style={{
              fontSize: "var(--font-size-sm)",
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
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
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
          marginBottom: "var(--space-3)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {currentPhase === "complete" ? (
            <>
              <StatusIcon status="success" size={16} />
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                Finished in {durationText}
              </span>
            </>
          ) : currentPhase === "error" ? (
            <>
              <StatusIcon status="error" size={16} />
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
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
                fontSize: "var(--font-size-sm)",
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

      {/* Horizontal Steps Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "var(--space-2)",
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
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: isRunningStep
                  ? "var(--color-surface-3)"
                  : isDoneStep
                  ? "var(--color-surface-2)"
                  : "transparent",
                border: isRunningStep
                  ? "1px solid var(--color-border-strong)"
                  : isDoneStep
                  ? "1px solid var(--color-border-subdued)"
                  : "1px solid transparent",
                transition: "background-color var(--transition-duration) var(--transition-timing)",
              }}
            >
              {/* Step Number + Status Icon or Text */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                  color: isRunningStep
                    ? "var(--color-text-primary)"
                    : isDoneStep
                    ? "var(--color-status-success)"
                    : "var(--color-text-muted)",
                }}
              >
                <span>Step {step.number}</span>

                {/* State indicator: Running text, check icon, skipped, or pending dot */}
                <span>
                  {isDoneStep ? (
                    <StatusIcon status="success" size={14} />
                  ) : isRunningStep ? (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--color-accent-primary)",
                      }}
                    >
                      Running
                    </span>
                  ) : isSkippedStep ? (
                    <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>Skipped</span>
                  ) : (
                    "○"
                  )}
                </span>
              </div>

              {/* Step Label */}
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: isRunningStep ? 600 : 400,
                  color: isRunningStep
                    ? "var(--color-text-primary)"
                    : isDoneStep
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-muted)",
                  lineHeight: 1.3,
                }}
              >
                {step.label}
              </span>

              {/* Model badge: only as small muted text on the three steps that use a model */}
              {step.modelBadge && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                    marginTop: "2px",
                  }}
                >
                  {step.modelBadge}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
