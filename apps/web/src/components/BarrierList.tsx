import React, { useState } from "react";

export interface BarrierItem {
  id: string;
  detectorId: string;
  severity: "blocker" | "major" | "minor";
  selector: string;
  wcagId: string;
  wcagName: string;
  wcagUrl: string;
  impact: string;
  evidence: string;
  fix?: {
    patchType?: string;
    targetSelector?: string;
    body?: string;
    rationale?: string;
    explanation?: string;
    cssRule?: string;
    attributes?: Record<string, string>;
    htmlReplacement?: string;
    scriptContent?: string;
  };
  verified: boolean;
  verificationEvidence?: string;
}

interface BarrierListProps {
  barriers: BarrierItem[];
  onOpenDiff: (barrier: BarrierItem) => void;
}

export const BarrierList: React.FC<BarrierListProps> = ({ barriers, onOpenDiff }) => {
  const [filter, setFilter] = useState<"all" | "blocker" | "major" | "minor" | "verified">("all");

  const filtered = barriers.filter((b) => {
    if (filter === "all") return true;
    if (filter === "verified") return b.verified;
    return b.severity === filter;
  });

  const getSeverityBadge = (severity: "blocker" | "major" | "minor") => {
    if (severity === "blocker") {
      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 5px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--color-severity-blocker-bg)",
            color: "var(--color-severity-blocker)",
            border: "1px solid var(--color-severity-blocker-border)",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          BLOCKER
        </span>
      );
    }
    if (severity === "major") {
      return (
        <span
          style={{
            display: "inline-block",
            padding: "2px 5px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--color-severity-major-bg)",
            color: "var(--color-severity-major)",
            border: "1px solid var(--color-severity-major-border)",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          MAJOR
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-block",
          padding: "2px 5px",
          borderRadius: "var(--radius-xs)",
          backgroundColor: "var(--color-severity-minor-bg)",
          color: "var(--color-severity-minor)",
          border: "1px solid var(--color-severity-minor-border)",
          fontSize: "10px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        MINOR
      </span>
    );
  };

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      {/* Header & Filter Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Discovered Barriers ({barriers.length})
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            Deterministic violations classified against WCAG 2.2 with verified fixes
          </div>
        </div>

        {/* Filter Segmented Controls (Sharp, Zero Pills) */}
        <div style={{ display: "flex", gap: "4px" }}>
          {(["all", "blocker", "major", "minor", "verified"] as const).map((f) => {
            const isSelected = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: isSelected ? "var(--color-surface-3)" : "var(--color-surface-2)",
                  border: isSelected ? "1px solid var(--color-border-focus)" : "1px solid var(--color-border-subdued)",
                  color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {f === "verified" ? "Verified" : f}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            padding: "28px",
            textAlign: "center",
            backgroundColor: "var(--color-surface-2)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-text-muted)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
          }}
        >
          {barriers.length === 0
            ? "No barriers detected. Keyboard access requirements satisfied."
            : "No barriers match the selected filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((b) => (
            <div
              key={b.id}
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-subdued)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  {getSeverityBadge(b.severity)}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      padding: "2px 5px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--color-surface-1)",
                      color: "var(--color-text-muted)",
                      border: "1px solid var(--color-border-subdued)",
                    }}
                  >
                    {b.detectorId}
                  </span>
                  <a
                    href={b.wcagUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-border-focus)",
                    }}
                  >
                    WCAG {b.wcagId} ({b.wcagName}) ↗
                  </a>
                </div>

                {b.fix ? (
                  <button
                    onClick={() => onOpenDiff(b)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: b.verified
                        ? "var(--color-accent-emerald-subtle)"
                        : "var(--color-surface-3)",
                      border: `1px solid ${
                        b.verified
                          ? "var(--color-accent-emerald-border)"
                          : "var(--color-border-subdued)"
                      }`,
                      color: b.verified
                        ? "var(--color-accent-emerald)"
                        : "var(--color-text-secondary)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {b.verified ? "✓ Inspect Verified Patch" : "Inspect Proposed Patch"}
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-muted)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-xs)",
                      backgroundColor: "var(--color-surface-1)",
                      border: "1px solid var(--color-border-subdued)",
                    }}
                  >
                    No Fix Generated
                  </span>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    marginBottom: "3px",
                  }}
                >
                  Element: {b.selector}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {b.evidence}
                </div>
              </div>

              {b.impact && (
                <div
                  style={{
                    fontSize: "12px",
                    backgroundColor: "var(--color-surface-1)",
                    borderLeft: "2px solid var(--color-border-focus)",
                    padding: "6px 10px",
                    borderRadius: "0 var(--radius-xs) var(--radius-xs) 0",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>User Impact: </strong>
                  {b.impact}
                </div>
              )}

              {/* Fix & Verification Status Callout */}
              {b.fix && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-xs)",
                    backgroundColor: b.verified
                      ? "rgba(16, 185, 129, 0.06)"
                      : "rgba(245, 158, 11, 0.06)",
                    border: `1px solid ${
                      b.verified
                        ? "var(--color-accent-emerald-border)"
                        : "var(--color-severity-major-border)"
                    }`,
                    fontSize: "11px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        fontSize: "10px",
                        letterSpacing: "0.04em",
                        color: b.verified
                          ? "var(--color-accent-emerald)"
                          : "var(--color-severity-major)",
                        padding: "1px 5px",
                        borderRadius: "var(--radius-xs)",
                        backgroundColor: b.verified
                          ? "var(--color-accent-emerald-subtle)"
                          : "rgba(245, 158, 11, 0.15)",
                      }}
                    >
                      {b.verified ? "✓ CHROMIUM VERIFIED" : "NEMOTRON ULTRA PROPOSAL"}
                    </span>
                    <span style={{ color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
                      {b.verificationEvidence || (b.verified
                        ? "Deterministic crawl verified: barrier eliminated with 0 regressions."
                        : "Patch generated; verification unconfirmed in headless crawl.")}
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenDiff(b)}
                    style={{
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                      border: "none",
                      color: b.verified ? "var(--color-accent-emerald)" : "var(--color-border-focus)",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    View Diff & Code →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
