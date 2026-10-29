import React from "react";
import type { AxeBaselineResult } from "@blindspot/engine";
import { StatusIcon } from "./ui/StatusIcon.js";

interface AxeBaselinePanelProps {
  baseline?: AxeBaselineResult;
  foundOnlyByBlindspot?: number;
  blockedResourcesCount?: number;
}

export const AxeBaselinePanel: React.FC<AxeBaselinePanelProps> = ({
  baseline,
  foundOnlyByBlindspot = 0,
  blockedResourcesCount,
}) => {
  if (!baseline) {
    return null;
  }

  const isZero = baseline.violationCount === 0;

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minWidth: "260px",
        boxSizing: "border-box",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-2)",
          }}
        >
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
            }}
          >
            axe-core baseline
          </span>
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
              backgroundColor: "var(--color-surface-2)",
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-subdued)",
            }}
          >
            v{baseline.version || "4.10.0"}
          </span>
        </div>

        {isZero ? (
          <div style={{ margin: "var(--space-3) 0 var(--space-4)" }}>
            <span
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: 600,
                color: "var(--color-status-success)",
                display: "block",
              }}
            >
              axe-core reported 0 violations
            </span>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-muted)",
                display: "block",
                marginTop: "4px",
              }}
            >
              Static DOM syntax passed all static rules
            </span>
          </div>
        ) : (
          <div style={{ margin: "var(--space-2) 0 var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
              <span
                style={{
                  fontSize: "var(--font-size-3xl)",
                  fontWeight: 600,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-severity-minor)",
                  lineHeight: 1.1,
                }}
              >
                {baseline.violationCount}
              </span>
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-muted)",
                }}
              >
                static violations
              </span>
            </div>
            {baseline.rules && baseline.rules.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-2)",
                }}
              >
                {baseline.rules.slice(0, 3).map((r) => (
                  <span
                    key={r.ruleId}
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-secondary)",
                      backgroundColor: "var(--color-surface-2)",
                      border: "1px solid var(--color-border-subdued)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {r.ruleId}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--color-border-subdued)",
          paddingTop: "var(--space-3)",
          marginTop: "var(--space-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
          <span
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--color-accent-secondary)",
            }}
          >
            Found only by BlindSpot: {foundOnlyByBlindspot}
          </span>
        </div>
        <span
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-muted)",
            display: "block",
            marginTop: "2px",
          }}
        >
          Runtime keyboard barriers missed by static scan
        </span>

        {blockedResourcesCount !== undefined && blockedResourcesCount > 0 && (
          <div
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-severity-major)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-severity-major)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <StatusIcon status="major" size={14} />
            <span>{blockedResourcesCount} external resources blocked</span>
          </div>
        )}
      </div>
    </div>
  );
};
