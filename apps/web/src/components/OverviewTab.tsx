import React from "react";
import type { BarrierItem } from "./BarrierList.js";
import { StatusIcon } from "./ui/StatusIcon.js";
import { Button } from "./ui/Button.js";

interface OverviewTabProps {
  barriers: BarrierItem[];
  onSelectTab: (tabId: string) => void;
  onOpenDiff?: (barrier: BarrierItem) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  barriers,
  onSelectTab,
  onOpenDiff,
}) => {
  if (barriers.length === 0) {
    return (
      <div
        className="neo-extruded"
        style={{
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-8)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "var(--font-size-lg)",
            fontWeight: 600,
            color: "var(--color-status-success)",
            margin: "0 0 var(--space-2) 0",
          }}
        >
          No keyboard problems found on this page.
        </p>
        <p
          style={{
            fontSize: "var(--font-size-base)",
            color: "var(--color-text-secondary)",
            margin: "0 0 var(--space-4) 0",
            lineHeight: 1.5,
          }}
        >
          Deterministic sequential crawl completed with zero detected keyboard traps or missing focus indicators.
        </p>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-primary)",
            fontWeight: 500,
            margin: 0,
          }}
        >
          What to do next: Test dynamic interactive states such as modal dialogs, drawers, and form submissions.
        </p>
      </div>
    );
  }

  // Find the most serious problem (blocker first, then major, then minor)
  const mostSerious =
    barriers.find((b) => b.severity === "blocker") ||
    barriers.find((b) => b.severity === "major") ||
    barriers[0];

  const isVerified = mostSerious.status === "verified" || mostSerious.verified;

  let severityLabel = "Minor";
  let severityStatus: "blocker" | "major" | "minor" = "minor";
  let severityColor = "var(--color-severity-minor)";

  if (mostSerious.severity === "blocker") {
    severityLabel = "Blocks keyboard use";
    severityStatus = "blocker";
    severityColor = "var(--color-severity-blocker)";
  } else if (mostSerious.severity === "major") {
    severityLabel = "Hard to use";
    severityStatus = "major";
    severityColor = "var(--color-severity-major)";
  }

  const whatToDoNext = isVerified
    ? "Review the verified fix in the Fixes tab and apply the suggested patch to your stylesheet or component markup."
    : "Review the problem details in the Problems tab to inspect manual remediation steps for this barrier.";

  return (
    <div
      className="neo-extruded"
      style={{
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginBottom: "var(--space-4)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Most serious problem
          </h2>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              marginTop: "2px",
            }}
          >
            Priority issue requiring immediate keyboard remediation
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => onSelectTab("problems")}
          >
            View all {barriers.length} problems →
          </Button>
          {isVerified && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSelectTab("fixes")}
            >
              View tested fixes →
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Most Serious Problem Card */}
      <div
        className="neo-sunken"
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        {/* Severity Badge & WCAG Citation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            marginBottom: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span
              className="neo-pill"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                color: severityColor,
                border: `1px solid ${severityColor}`,
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
              }}
            >
              <StatusIcon status={severityStatus} size={14} />
              <span>{severityLabel}</span>
            </span>

            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Detector {mostSerious.detectorId}
            </span>
          </div>

          <a
            href={mostSerious.wcagUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-accent-secondary)",
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            WCAG {mostSerious.wcagId} · {mostSerious.wcagName}
          </a>
        </div>

        {/* Target Selector */}
        <div style={{ margin: "var(--space-2) 0" }}>
          <span
            className="neo-pill"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-primary)",
              padding: "4px 12px",
            }}
          >
            {mostSerious.selector}
          </span>
        </div>

        {/* Plain-English Evidence */}
        <p
          style={{
            fontSize: "var(--font-size-base)",
            color: "var(--color-text-primary)",
            lineHeight: 1.5,
            margin: "var(--space-2) 0",
          }}
        >
          {mostSerious.evidence}
        </p>

        {/* Impact Explanation */}
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
            marginTop: "var(--space-2)",
          }}
        >
          <strong>Impact:</strong> {mostSerious.impact}
        </div>
      </div>

      {/* Next Actions & Next Step */}
      <div
        className="neo-extruded"
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-md)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ flex: "1 1 300px" }}>
          <strong style={{ display: "block", color: "var(--color-text-primary)", marginBottom: "2px" }}>
            Recommended next step:
          </strong>
          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
            {whatToDoNext}
          </span>
        </div>

        {isVerified && onOpenDiff && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onOpenDiff(mostSerious)}
          >
            Inspect verified fix →
          </Button>
        )}
      </div>
    </div>
  );
};
