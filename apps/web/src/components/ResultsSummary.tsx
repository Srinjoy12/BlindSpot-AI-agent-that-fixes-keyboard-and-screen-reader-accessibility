import React from "react";
import type { AxeBaselineResult } from "@blindspot/engine";
import { StatusIcon } from "./ui/StatusIcon.js";
import { Stat } from "./ui/Stat.js";
import type { BarrierItem } from "./BarrierList.js";

interface ResultsSummaryProps {
  barriers: BarrierItem[];
  fixesVerified?: number;
  baseline?: AxeBaselineResult | null;
  durationMs?: number;
  blockedResourcesCount?: number;
}

export const ResultsSummary: React.FC<ResultsSummaryProps> = ({
  barriers,
  fixesVerified = 0,
  baseline,
  durationMs = 0,
  blockedResourcesCount,
}) => {
  const totalProblems = barriers.length;
  const blockers = barriers.filter((b) => b.severity === "blocker").length;
  const majors = barriers.filter((b) => b.severity === "major").length;
  const minors = barriers.filter((b) => b.severity === "minor").length;
  const fixesTested = barriers.filter((b) => b.status === "verified" || b.verified).length || fixesVerified;

  // 1. Headline sentence built from data
  // When no results: "No keyboard problems found on this page." (must NOT say the page is accessible or compliant)
  const headlineSentence =
    totalProblems === 0
      ? "No keyboard problems found on this page."
      : fixesTested > 0
      ? `${totalProblems} problem${totalProblems === 1 ? "" : "s"} found. ${fixesTested} fix${
          fixesTested === 1 ? "" : "es"
        } tested and working.`
      : `${totalProblems} problem${totalProblems === 1 ? "" : "s"} found. Fix generation pending.`;

  // 2. Axe-core comparison calculations
  const axeCount = baseline?.violationCount ?? 0;
  const foundOnlyByBlindspot = barriers.filter((b) => !b.alsoReportedByAxe).length;
  const overlapCount = barriers.filter((b) => b.alsoReportedByAxe).length;
  const axeVersion = baseline?.version || "4.14.0";

  let axeComparisonText = "";
  if (axeCount === 0) {
    axeComparisonText = `axe-core found 0 issues. BlindSpot found ${foundOnlyByBlindspot} more that need a keyboard to discover.`;
  } else {
    const overlapNotice = overlapCount > 0 ? ` (${overlapCount} overlap with axe-core)` : "";
    axeComparisonText = `axe-core found ${axeCount} issue${
      axeCount === 1 ? "" : "s"
    }. BlindSpot found ${foundOnlyByBlindspot} more that need a keyboard to discover${overlapNotice}.`;
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
    >
      {/* Top Headline + Time Taken */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          marginBottom: "var(--space-3)",
        }}
      >
        <p
          style={{
            fontSize: "var(--font-size-lg)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {headlineSentence}
        </p>

        {durationMs > 0 && (
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Time taken: {(durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Four Stats Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "var(--space-3)",
          padding: "var(--space-3) 0",
          borderTop: "1px solid var(--color-border-subdued)",
          borderBottom: "1px solid var(--color-border-subdued)",
          marginBottom: "var(--space-3)",
        }}
      >
        {/* Stat 1: Blocks keyboard use */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <StatusIcon status="blocker" size={14} />
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Blocks keyboard use
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: blockers > 0 ? "var(--color-severity-blocker)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {blockers}
          </div>
        </div>

        {/* Stat 2: Hard to use */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <StatusIcon status="major" size={14} />
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Hard to use
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: majors > 0 ? "var(--color-severity-major)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {majors}
          </div>
        </div>

        {/* Stat 3: Minor */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <StatusIcon status="minor" size={14} />
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Minor
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: minors > 0 ? "var(--color-severity-minor)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {minors}
          </div>
        </div>

        {/* Stat 4: Fixes tested */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <StatusIcon status="success" size={14} />
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Fixes tested
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 600,
              fontFamily: "var(--font-mono)",
              color: fixesTested > 0 ? "var(--color-status-success)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {fixesTested} of {totalProblems}
          </div>
        </div>
      </div>

      {/* Axe Comparison Calm Row (calm row, not a panel) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
            {axeComparisonText}
          </span>
          <span
            style={{
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            axe-core v{axeVersion} (run with: default rules & tags)
          </span>
        </div>

        {/* Two numbers side by side with plain labels */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                color: "var(--color-text-muted)",
              }}
            >
              {axeCount}
            </span>
            <span style={{ color: "var(--color-text-muted)" }}>Checker only</span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                color: "var(--color-text-primary)",
              }}
            >
              {totalProblems}
            </span>
            <span style={{ color: "var(--color-text-secondary)" }}>With keyboard test</span>
          </div>
        </div>
      </div>

      {/* Blocked external resources note if any */}
      {blockedResourcesCount !== undefined && blockedResourcesCount > 0 && (
        <div
          style={{
            marginTop: "var(--space-2)",
            paddingTop: "var(--space-2)",
            borderTop: "1px dashed var(--color-border-subdued)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-severity-major)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <StatusIcon status="major" size={14} />
          <span>{blockedResourcesCount} external resources blocked in airgapped session</span>
        </div>
      )}
    </div>
  );
};
