import React, { useState } from "react";
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
  };
  filePath?: string;
  originalSource?: string;
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
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "2px 8px",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--color-surface-1)",
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
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
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
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 4px 0",
            }}
          >
            Problems ({barriers.length})
          </h2>
          {/* One-line definition for first-time users - no tooltips needed */}
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
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: isSelected ? "var(--color-surface-3)" : "var(--color-surface-2)",
                  border: isSelected ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subdued)",
                  color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  minHeight: "36px",
                  transition: "background-color var(--transition-duration) var(--transition-timing)",
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
          style={{
            padding: "var(--space-6)",
            textAlign: "center",
            backgroundColor: "var(--color-surface-2)",
            borderRadius: "var(--radius-sm)",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          {barriers.length === 0
            ? "No keyboard problems found on this page."
            : "No problems match the selected filter."}
        </div>
      ) : (
        /* Master-Detail Responsive Container */
        <div
          className="master-detail-container"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--space-4)",
            alignItems: "start",
          }}
        >
          {/* List Column: One row per problem */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
            role="region"
            aria-label="Problem list"
          >
            {filtered.map((b) => {
              const itemDetail = getProblemDetail(b);
              const isSelected = selectedBarrier?.id === b.id;
              const isFixTested = b.verified || b.status === "verified";

              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(b.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`${itemDetail.plainTitle}, element ${b.selector}`}
                  style={{
                    backgroundColor: isSelected ? "var(--color-surface-3)" : "var(--color-surface-2)",
                    border: isSelected ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subdued)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-3) var(--space-4)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                    transition: "all var(--transition-duration) var(--transition-timing)",
                    outline: "none",
                  }}
                >
                  {/* Row Top: Severity + Plain Title */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    {getSeverityBadge(b.severity)}
                    <div
                      style={{
                        fontSize: "var(--font-size-base)",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        lineHeight: 1.4,
                        flex: 1,
                      }}
                    >
                      {itemDetail.plainTitle}
                    </div>
                  </div>

                  {/* Row Bottom: Monospace Element, WCAG criterion label, Fix Tested status */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "var(--space-2)",
                      fontSize: "var(--font-size-sm)",
                      paddingTop: "var(--space-1)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      {/* Page element in monospace */}
                      <code
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--font-size-sm)",
                          backgroundColor: "var(--color-surface-1)",
                          border: "1px solid var(--color-border-subdued)",
                          padding: "1px 6px",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--color-text-primary)",
                          wordBreak: "break-all",
                        }}
                      >
                        {b.selector}
                      </code>

                      {/* WCAG criterion as short link-styled label */}
                      <a
                        href={b.wcagUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: "var(--font-size-sm)",
                          color: "var(--color-accent-secondary)",
                          textDecoration: "underline",
                        }}
                      >
                        {b.wcagId} {b.wcagName} ↗
                      </a>
                    </div>

                    {/* Fix tested or Fix not tested with icon */}
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "var(--font-size-sm)",
                        fontWeight: 600,
                        color: isFixTested ? "var(--color-status-success)" : "var(--color-text-muted)",
                      }}
                    >
                      <StatusIcon status={isFixTested ? "success" : "warning"} size={14} />
                      <span>{isFixTested ? "Fix tested" : "Fix not tested"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail Panel Column: Opens on select */}
          {selectedBarrier && detail && (
            <div
              style={{
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
                position: "sticky",
                top: "var(--space-4)",
              }}
              role="region"
              aria-label={`Details for problem: ${detail.plainTitle}`}
            >
              {/* Detail Header */}
              <div
                style={{
                  paddingBottom: "var(--space-3)",
                  borderBottom: "1px solid var(--color-border-subdued)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                  {getSeverityBadge(selectedBarrier.severity)}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-sm)",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-surface-1)",
                      color: "var(--color-text-secondary)",
                      border: "1px solid var(--color-border-subdued)",
                    }}
                  >
                    Detector {selectedBarrier.detectorId}
                  </span>
                </div>

                <h3
                  style={{
                    fontSize: "var(--font-size-lg)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: "0 0 6px 0",
                    lineHeight: 1.4,
                  }}
                >
                  {detail.plainTitle}
                </h3>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Target:</span>
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-sm)",
                      backgroundColor: "var(--color-surface-1)",
                      border: "1px solid var(--color-border-subdued)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--color-text-primary)",
                      wordBreak: "break-all",
                    }}
                  >
                    {selectedBarrier.selector}
                  </code>
                </div>
              </div>

              {/* Section 1: What happens (keyboard steps) */}
              <div>
                <h4
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: "0 0 var(--space-2) 0",
                  }}
                >
                  What happens (keyboard reproduction)
                </h4>
                <div
                  style={{
                    backgroundColor: "var(--color-surface-1)",
                    border: "1px solid var(--color-border-subdued)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {detail.keyboardSteps.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Who it affects (Super model impact, max 2-3 sentences) */}
              <div>
                <h4
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: "0 0 var(--space-2) 0",
                  }}
                >
                  Who it affects
                </h4>
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.5,
                    backgroundColor: "var(--color-surface-1)",
                    borderLeft: "3px solid var(--color-accent-secondary)",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                  }}
                >
                  {detail.whoItAffects}
                </div>
              </div>

              {/* Section 3: Evidence */}
              <div>
                <h4
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: "0 0 var(--space-2) 0",
                  }}
                >
                  Evidence
                </h4>
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-secondary)",
                    backgroundColor: "var(--color-surface-1)",
                    border: "1px solid var(--color-border-subdued)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-3)",
                    lineHeight: 1.5,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {detail.evidence}
                </div>
              </div>

              {/* Section 4: Tavily / WCAG Guidance Source Link */}
              <div>
                <h4
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: "0 0 var(--space-2) 0",
                  }}
                >
                  Guidance source
                </h4>
                <a
                  href={detail.tavilyGuidanceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-accent-secondary)",
                    textDecoration: "underline",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{detail.tavilyGuidanceLabel} ↗</span>
                </a>
              </div>

              {/* Section 5: The Fix */}
              <div
                style={{
                  paddingTop: "var(--space-3)",
                  borderTop: "1px solid var(--color-border-subdued)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--space-2)",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      margin: 0,
                    }}
                  >
                    The fix
                  </h4>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: selectedBarrier.verified ? "var(--color-status-success)" : "var(--color-text-muted)",
                    }}
                  >
                    <StatusIcon status={selectedBarrier.verified ? "success" : "warning"} size={14} />
                    <span>{selectedBarrier.verified ? "Fix tested" : "Fix not tested"}</span>
                  </span>
                </div>

                {selectedBarrier.fix ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                      {selectedBarrier.fix.rationale || "Standard deterministic accessibility fix."}
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        padding: "var(--space-3)",
                        backgroundColor: "var(--color-bg-canvas)",
                        border: "1px solid var(--color-border-subdued)",
                        borderRadius: "var(--radius-sm)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-text-primary)",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {selectedBarrier.fix.body ||
                        selectedBarrier.fix.cssRule ||
                        selectedBarrier.fix.diff ||
                        selectedBarrier.fix.htmlReplacement ||
                        "Automated code repair available."}
                    </pre>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenDiff(selectedBarrier)}
                      style={{ alignSelf: "flex-start", marginTop: "var(--space-1)" }}
                    >
                      {selectedBarrier.verified ? "✓ Inspect tested fix in full diff" : "Inspect proposed fix"}
                    </Button>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-muted)",
                      backgroundColor: "var(--color-surface-1)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    No fix generated for this barrier.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
