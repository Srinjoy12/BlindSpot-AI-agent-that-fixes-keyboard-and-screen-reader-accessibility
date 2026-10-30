import React from "react";
import type { AxeBaselineResult } from "@blindspot/engine";
import { StatusIcon } from "./ui/StatusIcon.js";
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

  // Headline sentence built from data
  const headlineSentence =
    totalProblems === 0
      ? "No keyboard problems found on this page."
      : fixesTested > 0
      ? `${totalProblems} problem${totalProblems === 1 ? "" : "s"} found. ${fixesTested} fix${
          fixesTested === 1 ? "" : "es"
        } tested and working.`
      : `${totalProblems} problem${totalProblems === 1 ? "" : "s"} found. Fix generation pending.`;

  // Axe-core comparison calculations
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
      className="neo-extruded"
      style={{
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
        marginBottom: "var(--space-6)",
      }}
    >
      {/* Top Headline + Time Taken */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginBottom: "var(--space-4)",
        }}
      >
        <p
          style={{
            fontSize: "var(--font-size-xl)",
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
            className="neo-pill"
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              fontFamily: "var(--font-mono)",
              padding: "4px 12px",
            }}
          >
            Time taken: {(durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* 4-Card Stat Grid: Extruded Tactile Slabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-4)",
        }}
      >
        {/* Stat 1: Blocks keyboard use (Deep coral/crimson inset badge) */}
        <div
          className="neo-extruded"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: blockers > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Blocks keyboard use
            </span>
            <div
              className="neo-sunken"
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: blockers > 0 ? "rgba(185, 28, 28, 0.15)" : "transparent",
                color: blockers > 0 ? "var(--color-severity-blocker)" : "var(--color-text-muted)",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Blocker
            </div>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-3xl)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: blockers > 0 ? "var(--color-severity-blocker)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {blockers}
          </div>
        </div>

        {/* Stat 2: Hard to use */}
        <div
          className="neo-extruded"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Hard to use
            </span>
            <span
              className="neo-pill"
              style={{
                padding: "2px 8px",
                fontSize: "12px",
                fontWeight: 600,
                color: majors > 0 ? "var(--color-severity-major)" : "var(--color-text-muted)",
              }}
            >
              Major
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-3xl)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: majors > 0 ? "var(--color-severity-major)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {majors}
          </div>
        </div>

        {/* Stat 3: Minor */}
        <div
          className="neo-extruded"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Minor
            </span>
            <span
              className="neo-pill"
              style={{
                padding: "2px 8px",
                fontSize: "12px",
                fontWeight: 600,
                color: minors > 0 ? "var(--color-severity-minor)" : "var(--color-text-muted)",
              }}
            >
              Notice
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-3xl)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: minors > 0 ? "var(--color-severity-minor)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {minors}
          </div>
        </div>

        {/* Stat 4: Verified fixes (Crisp Lime Green convex badge with Invoca Green text) */}
        <div
          className="neo-extruded"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)",
            border: fixesTested > 0 ? "1px solid rgba(132, 204, 22, 0.4)" : undefined,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              Verified fixes
            </span>
            <span
              style={{
                padding: "2px 10px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-accent-primary)",
                color: "#FFFFFF",
                border: "1px solid var(--color-status-success)",
                boxShadow: "2px 2px 6px rgba(27, 94, 59, 0.3)",
                fontSize: "12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>✓</span>
              <span>Verified</span>
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-3xl)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: fixesTested > 0 ? "var(--color-status-success)" : "var(--color-text-primary)",
              lineHeight: 1.1,
            }}
          >
            {fixesTested} <span style={{ fontSize: "var(--font-size-lg)", fontWeight: 400, color: "var(--color-text-muted)" }}>of {totalProblems}</span>
          </div>
        </div>
      </div>

      {/* axe-core Comparison Card: Sunken Debossed Comparison Pill */}
      <div
        className="neo-sunken"
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
            {axeComparisonText}
          </span>
          <span
            style={{
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
            }}
          >
            axe-core v{axeVersion} (static baseline)
          </span>
        </div>

        {/* Two numbers side by side with plain labels */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <div
            className="neo-pill"
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
              padding: "4px 12px",
              backgroundColor: "var(--color-surface-2)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "var(--font-size-base)",
                color: "var(--color-text-muted)",
              }}
            >
              {axeCount}
            </span>
            <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>Checker only</span>
          </div>

          <div
            className="neo-pill"
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
              padding: "4px 14px",
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-accent-secondary)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "var(--font-size-base)",
                color: "var(--color-accent-secondary)",
              }}
            >
              {totalProblems}
            </span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600, fontSize: "12px" }}>
              With keyboard test
            </span>
          </div>
        </div>
      </div>

      {/* Blocked external resources note if any */}
      {blockedResourcesCount !== undefined && blockedResourcesCount > 0 && (
        <div
          style={{
            marginTop: "var(--space-3)",
            paddingTop: "var(--space-2)",
            borderTop: "1px dashed var(--color-border-subdued)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-severity-major)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <StatusIcon status="major" size={14} />
          <span>{blockedResourcesCount} external resources blocked in airgapped session</span>
        </div>
      )}
    </div>
  );
};
