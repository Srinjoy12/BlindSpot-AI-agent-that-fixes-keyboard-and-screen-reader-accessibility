import React, { useState } from "react";
import type { ReactEquivalent } from "@blindspot/ai";
import { StatusIcon, type StatusType } from "./ui/StatusIcon.js";
import { Button } from "./ui/Button.js";
import { getProblemDetail } from "../utils/problemDescriptions.js";

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
    diff?: string;
    modifiedSource?: string;
    cssRule?: string;
    attributes?: Record<string, string>;
    htmlReplacement?: string;
    scriptContent?: string;
    filePath?: string;
    originalSource?: string;
    reactEquivalent?: ReactEquivalent;
  };
  filePath?: string;
  originalSource?: string;
  reactEquivalent?: ReactEquivalent;
  likelySource?: {
    path: string;
    confidence: "high" | "low";
    matchedSignals: string[];
    candidates?: {
      path: string;
      score?: number;
      confidence: "high" | "low";
      matchedSignals: string[];
    }[];
  };
  verified: boolean;
  status?: "verified" | "unverified" | "rejected";
  diff?: string;
  modifiedSource?: string;
  rejectionReason?: string;
  beforeCrawlSummary?: {
    stopsCount: number;
    hitsCount: number;
    blockersCount: number;
    majorsCount: number;
  };
  afterCrawlSummary?: {
    stopsCount: number;
    hitsCount: number;
    blockersCount: number;
    majorsCount: number;
  };
  afterStops?: any[];
  verificationEvidence?: string;
  alsoReportedByAxe?: boolean;
}

interface BarrierListProps {
  barriers: BarrierItem[];
  onOpenDiff: (barrier: BarrierItem) => void;
}

export const BarrierList: React.FC<BarrierListProps> = ({ barriers, onOpenDiff }) => {
  const [filter, setFilter] = useState<"all" | "blocker" | "major" | "minor" | "verified">("all");
  const [selectedId, setSelectedId] = useState<string | null>(barriers[0]?.id || null);

  const filtered = barriers.filter((b) => {
    if (filter === "all") return true;
    if (filter === "verified") return b.verified || b.status === "verified";
    return b.severity === filter;
  });

  const selectedBarrier = barriers.find((b) => b.id === selectedId) || filtered[0] || null;
  const detail = selectedBarrier ? getProblemDetail(selectedBarrier) : null;

  const getSeverityBadge = (severity: "blocker" | "major" | "minor") => {
    let label = "Minor";
    let statusType: StatusType = "minor";
    let color = "var(--color-severity-minor)";

    if (severity === "blocker") {
      label = "Blocks keyboard use";
      statusType = "blocker";
      color = "var(--color-severity-blocker)";
    } else if (severity === "major") {
      label = "Hard to use";
      statusType = "major";
      color = "var(--color-severity-major)";
    }

    return (
      <span
        className="neo-pill"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 10px",
          color,
          border: `1px solid ${color}`,
          fontSize: "var(--font-size-sm)",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <StatusIcon status={statusType} size={14} />
        <span>{label}</span>
      </span>
    );
  };

  return (
    <div
      className="neo-extruded"
      style={{
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
        marginBottom: "var(--space-6)",
      }}
    >
      {/* Header with Plain Definitions Help Text */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
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
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 4px 0",
            }}
          >
            Problems ({barriers.length})
          </h2>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            A keyboard trap prevents someone using Tab from ever leaving an element. A focus indicator is the visual outline showing which element is currently active.
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {(
            [
              { id: "all", label: "All" },
              { id: "blocker", label: "Blocks keyboard use" },
              { id: "major", label: "Hard to use" },
              { id: "minor", label: "Minor" },
              { id: "verified", label: "Fix tested" },
            ] as const
          ).map((f) => {
            const isSelected = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="neo-pill"
                aria-pressed={isSelected}
                style={{
                  padding: "6px 14px",
                  backgroundColor: isSelected ? "var(--color-accent-primary)" : "var(--neo-pill-bg)",
                  color: isSelected ? "#FFFFFF" : "var(--color-text-secondary)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: isSelected ? 600 : 400,
                  minHeight: "36px",
                  border: isSelected ? "1px solid var(--color-accent-primary)" : "1px solid var(--color-border-subdued)",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="neo-sunken"
          style={{
            padding: "var(--space-8)",
            textAlign: "center",
            borderRadius: "var(--radius-lg)",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-base)",
          }}
        >
          {barriers.length === 0
            ? "No keyboard problems found on this page."
            : "No problems match the selected filter."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "var(--space-4)",
          }}
        >
          {/* Column 1: List of Problems */}
          <div
            tabIndex={0}
            role="region"
            aria-label="List of detected accessibility problems"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              maxHeight: "560px",
              overflowY: "auto",
              paddingRight: "var(--space-2)",
            }}
          >
            {filtered.map((b) => {
              const itemDetail = getProblemDetail(b);
              const isSelected = b.id === (selectedBarrier?.id || "");
              const isVerified = b.status === "verified" || b.verified;

              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  aria-selected={isSelected}
                  className={isSelected ? "neo-extruded" : "neo-pill"}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "6px",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: isSelected ? "var(--neo-extruded-bg)" : "var(--neo-pill-bg)",
                    border: isSelected
                      ? "2px solid var(--color-focus-ring)"
                      : "1px solid var(--color-border-subdued)",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      {getSeverityBadge(b.severity)}
                      {b.alsoReportedByAxe ? (
                        <span
                          className="neo-pill"
                          style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            padding: "1px 6px",
                            color: "var(--color-text-muted)",
                            border: "1px solid var(--color-border-subdued)",
                          }}
                        >
                          Reported by axe-core
                        </span>
                      ) : (
                        <span
                          className="neo-pill"
                          style={{
                            fontSize: "11px",
                            fontFamily: "var(--font-mono)",
                            padding: "1px 6px",
                            color: "var(--color-accent-secondary)",
                            border: "1px solid rgba(14, 165, 233, 0.4)",
                            backgroundColor: "rgba(14, 165, 233, 0.08)",
                          }}
                        >
                          axe-core missed this
                        </span>
                      )}
                    </div>

                    {isVerified && (
                      <span
                        className="neo-pill"
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          backgroundColor: "var(--color-accent-primary)",
                          color: "#FFFFFF",
                          padding: "2px 10px",
                          border: "1px solid var(--color-status-success)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>✓</span>
                        <span>Fix tested</span>
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: "var(--font-size-base)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      lineHeight: 1.4,
                      marginTop: "2px",
                    }}
                  >
                    {itemDetail.plainTitle}
                  </div>

                  <div
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {b.selector}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Column 2: Detailed Problem View */}
          {selectedBarrier && detail && (
            <div
              className="neo-sunken"
              style={{
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-6)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {getSeverityBadge(selectedBarrier.severity)}
                    {selectedBarrier.alsoReportedByAxe ? (
                      <span
                        className="neo-pill"
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          padding: "2px 8px",
                          color: "var(--color-text-muted)",
                          border: "1px solid var(--color-border-subdued)",
                        }}
                      >
                        Reported by axe-core
                      </span>
                    ) : (
                      <span
                        className="neo-pill"
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          padding: "2px 8px",
                          color: "var(--color-accent-secondary)",
                          border: "1px solid rgba(14, 165, 233, 0.4)",
                          backgroundColor: "rgba(14, 165, 233, 0.08)",
                        }}
                      >
                        axe-core missed this
                      </span>
                    )}
                  </div>
                  <h3
                    style={{
                      fontSize: "var(--font-size-xl)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      marginTop: "var(--space-2)",
                      lineHeight: 1.3,
                    }}
                  >
                    {detail.plainTitle}
                  </h3>
                </div>

                <a
                  href={selectedBarrier.wcagUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-accent-secondary)",
                    textDecoration: "underline",
                    fontWeight: 500,
                  }}
                >
                  WCAG {selectedBarrier.wcagId}
                </a>
              </div>

              <div>
                <strong style={{ display: "block", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  Element selector:
                </strong>
                <code
                  className="neo-sunken"
                  style={{
                    display: "block",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-sm)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-primary)",
                    wordBreak: "break-all",
                  }}
                >
                  {selectedBarrier.selector}
                </code>
              </div>

              <div>
                <strong style={{ display: "block", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  What went wrong:
                </strong>
                <p style={{ margin: 0, fontSize: "var(--font-size-base)", color: "var(--color-text-primary)", lineHeight: 1.5 }}>
                  {detail.plainDescription}
                </p>
              </div>

              <div>
                <strong style={{ display: "block", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  Who is affected:
                </strong>
                <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {detail.whoIsAffected}
                </p>
              </div>

              <div>
                <strong style={{ display: "block", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  How to fix it:
                </strong>
                <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {detail.howToFixIt}
                </p>
              </div>

              {(selectedBarrier.fix || selectedBarrier.diff || selectedBarrier.modifiedSource) && (
                <div style={{ marginTop: "auto", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subdued)" }}>
                  <Button
                    variant="primary"
                    onClick={() => onOpenDiff(selectedBarrier)}
                    style={{ width: "100%" }}
                  >
                    Inspect verified fix →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
