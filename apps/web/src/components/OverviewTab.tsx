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
        style={{
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-6)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "var(--font-size-base)",
            fontWeight: 600,
            color: "var(--color-status-success)",
            margin: "0 0 var(--space-2) 0",
          }}
        >
          No keyboard problems found on this page.
        </p>
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
            margin: "0 0 var(--space-4) 0",
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

  // One sentence for what to do next
  const whatToDoNext = isVerified
    ? "Review the verified fix in the Fixes tab and apply the suggested patch to your stylesheet or component markup."
    : "Review the problem details in the Problems tab to inspect manual remediation steps for this barrier.";

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
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
        <div>
          <h2
            style={{
              fontSize: "var(--font-size-base)",
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
        style={{
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-sm)",
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
            marginBottom: "var(--space-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-surface-1)",
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
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
              display: "block",
              marginBottom: "2px",
            }}
          >
            Element:
          </span>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-primary)",
              backgroundColor: "var(--color-surface-1)",
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-subdued)",
              display: "inline-block",
              wordBreak: "break-all",
            }}
          >
            {mostSerious.selector}
          </code>
        </div>

        {/* Impact & Evidence */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "var(--space-2)",
            margin: "var(--space-3) 0",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
              }}
            >
              Impact:{" "}
            </span>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-primary)",
              }}
            >
              {mostSerious.impact}
            </span>
          </div>

          <div>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
              }}
            >
              Evidence:{" "}
            </span>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {mostSerious.evidence}
            </span>
          </div>
        </div>

        {/* Verified Fix Status */}
        <div
          style={{
            paddingTop: "var(--space-2)",
            borderTop: "1px solid var(--color-border-subdued)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <StatusIcon status={isVerified ? "success" : "warning"} size={14} />
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: isVerified ? "var(--color-status-success)" : "var(--color-text-secondary)",
              }}
            >
              {isVerified
                ? "Fix tested in a real browser: barrier eliminated with zero regressions."
                : "Fix pending test: proposed changes require browser verification."}
            </span>
          </div>

          {isVerified && onOpenDiff && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenDiff(mostSerious)}
            >
              Inspect fix diff →
            </Button>
          )}
        </div>
      </div>

      {/* What to do next (single sentence) */}
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          backgroundColor: "var(--color-surface-2)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--color-accent-secondary)",
        }}
      >
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          What to do next:{" "}
        </span>
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          {whatToDoNext}
        </span>
      </div>
    </div>
  );
};
