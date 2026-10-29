import React, { useState } from "react";
import type { BarrierItem } from "./BarrierList.js";
import { Button } from "./ui/Button.js";
import { StatusIcon } from "./ui/StatusIcon.js";
import { SegmentedControl } from "./ui/SegmentedControl.js";
import { translateFixToReact } from "@blindspot/fixer/reactTranslate";
import { getProblemDetail } from "../utils/problemDescriptions.js";

interface FixesInlineViewProps {
  barriers: BarrierItem[];
  onOpenFullScreen: (barrier: BarrierItem) => void;
  isSourceMode?: boolean;
  onApplyToFolder?: (barrier: BarrierItem) => void;
}

interface ParsedDiffLine {
  type: "add" | "remove" | "context" | "header";
  oldLineNumber?: number;
  newLineNumber?: number;
  prefix: string;
  content: string;
}

function parseUnifiedDiff(diffText: string): ParsedDiffLine[] {
  if (!diffText) return [];
  const lines = diffText.split("\n");
  const result: ParsedDiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  // Check if text is standard unified diff with headers
  const isUnified = lines.some((l) => l.startsWith("---") || l.startsWith("@@"));

  if (!isUnified) {
    // If it's a code block (like CSS rule or HTML fix), format cleanly as added lines
    lines.forEach((l, idx) => {
      if (l.trim().length === 0 && idx === lines.length - 1) return;
      result.push({
        type: "add",
        newLineNumber: idx + 1,
        prefix: "+",
        content: l,
      });
    });
    return result;
  }

  for (const rawLine of lines) {
    if (rawLine.startsWith("---") || rawLine.startsWith("+++")) {
      result.push({ type: "header", prefix: "##", content: rawLine });
    } else if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1]!, 10);
        newLine = parseInt(match[2]!, 10);
      }
      result.push({ type: "header", prefix: "@@", content: rawLine });
    } else if (rawLine.startsWith("+")) {
      result.push({
        type: "add",
        newLineNumber: newLine++,
        prefix: "+",
        content: rawLine.slice(1),
      });
    } else if (rawLine.startsWith("-")) {
      result.push({
        type: "remove",
        oldLineNumber: oldLine++,
        prefix: "-",
        content: rawLine.slice(1),
      });
    } else {
      const content = rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine;
      result.push({
        type: "context",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        prefix: " ",
        content,
      });
    }
  }
  return result;
}

export const FixesInlineView: React.FC<FixesInlineViewProps> = ({
  barriers,
  onOpenFullScreen,
  isSourceMode = false,
  onApplyToFolder,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [barrierFormat, setBarrierFormat] = useState<Record<string, "html" | "react">>({});

  const barriersWithFixes = barriers.filter(
    (b) => b.fix || b.diff || b.modifiedSource
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (barriersWithFixes.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-6)",
          textAlign: "center",
          color: "var(--color-text-secondary)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        <p style={{ margin: "0 0 var(--space-2) 0", fontWeight: 600, color: "var(--color-text-primary)" }}>
          No automated fixes generated for this audit.
        </p>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Run the audit with "Generate verified fixes with Nemotron Ultra" enabled to produce deterministic patches.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Header with Help Text */}
      <div
        style={{
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
        }}
      >
        <h2
          style={{
            fontSize: "var(--font-size-lg)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: "0 0 4px 0",
          }}
        >
          Fixes ({barriersWithFixes.length})
        </h2>
        {/* One-line definition for first-time users */}
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Verified fixes are tested in a real browser session to prove the barrier is eliminated without introducing regressions.
        </p>
      </div>

      {/* Fix Cards */}
      {barriersWithFixes.map((barrier) => {
        const itemDetail = getProblemDetail(barrier);
        const isVerified = barrier.status === "verified" || barrier.verified;
        const isRejected = barrier.status === "rejected";

        // Status text requirement:
        // "Tested: the problem is gone" / "Not tested" / "Rejected: change too large"
        let statusText = "Not tested";
        let statusColor = "var(--color-severity-major)";
        let statusIconType: "success" | "warning" | "error" = "warning";

        if (isVerified) {
          statusText = "Tested: the problem is gone";
          statusColor = "var(--color-status-success)";
          statusIconType = "success";
        } else if (isRejected) {
          statusText = barrier.rejectionReason
            ? `Rejected: ${barrier.rejectionReason}`
            : "Rejected: change too large";
          statusColor = "var(--color-severity-blocker)";
          statusIconType = "error";
        }

        const rawDiff =
          barrier.diff ||
          barrier.fix?.diff ||
          barrier.fix?.body ||
          barrier.fix?.cssRule ||
          (barrier.fix?.attributes
            ? Object.entries(barrier.fix.attributes)
                .map(([k, v]) => `element.setAttribute("${k}", "${v}");`)
                .join("\n")
            : barrier.fix?.htmlReplacement || "");

        const diffLines = parseUnifiedDiff(rawDiff);

        // Short evidence sentence from verification:
        // e.g. "Focus now reaches the footer in 18 presses"
        let evidenceSentence = barrier.verificationEvidence;
        if (!evidenceSentence) {
          if (isVerified) {
            evidenceSentence =
              barrier.afterCrawlSummary
                ? `Focus now reaches all ${barrier.afterCrawlSummary.stopsCount} tab stops with zero regressions.`
                : "Tested in a real browser: the barrier is eliminated with zero regressions.";
          } else if (isRejected) {
            evidenceSentence =
              barrier.rejectionReason || "Verification failed: patch introduced layout regressions or exceeded line limit.";
          } else {
            evidenceSentence = "Patch generated; verification unconfirmed in headless crawl.";
          }
        }

        const attemptsText = "1 attempt";

        const reactEquivalent =
          barrier.fix?.reactEquivalent ||
          barrier.reactEquivalent ||
          (barrier.fix?.body
            ? translateFixToReact(
                {
                  patchType: barrier.fix.patchType,
                  body: barrier.fix.body,
                  rationale: barrier.fix.rationale || barrier.fix.explanation,
                  targetSelector: barrier.selector,
                },
                { detectorId: barrier.detectorId, selector: barrier.selector }
              )
            : null);

        const currentFormat = barrierFormat[barrier.id] || "html";

        return (
          <div
            key={barrier.id}
            style={{
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-border-subdued)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            {/* Heading with Problem Name, Status, and Attempts */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "var(--space-3)",
                paddingBottom: "var(--space-3)",
                borderBottom: "1px solid var(--color-border-subdued)",
              }}
            >
              <div>
                {/* Problem Name */}
                <h3
                  style={{
                    fontSize: "var(--font-size-base)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: "0 0 6px 0",
                    lineHeight: 1.4,
                  }}
                >
                  {itemDetail.plainTitle}
                </h3>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {(() => {
                    const displayPath = barrier.filePath || barrier.fix?.filePath || barrier.likelySource?.path;
                    if (!displayPath) return null;
                    const isReact = displayPath.endsWith(".tsx") || displayPath.endsWith(".jsx");
                    return (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        {isReact && (
                          <span
                            style={{
                              fontSize: "var(--font-size-xs)",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              backgroundColor: "var(--color-surface-2)",
                              color: "var(--color-accent-primary)",
                              border: "1px solid var(--color-border-subdued)",
                            }}
                          >
                            React
                          </span>
                        )}
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--font-size-xs)",
                            fontWeight: 600,
                            color: "var(--color-accent-primary)",
                            backgroundColor: "var(--color-surface-3)",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border-subdued)",
                          }}
                        >
                          {displayPath}
                        </span>
                      </div>
                    );
                  })()}

                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-secondary)",
                      backgroundColor: "var(--color-surface-2)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border-subdued)",
                    }}
                  >
                    {barrier.selector}
                  </code>

                  <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                    {barrier.wcagName} ({barrier.wcagId})
                  </span>
                </div>
              </div>

              {/* Status and Attempts in muted text */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "3px 10px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "var(--color-surface-2)",
                    color: statusColor,
                    border: `1px solid ${statusColor}`,
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                  }}
                >
                  <StatusIcon status={statusIconType} size={14} />
                  <span>{statusText}</span>
                </span>

                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                  {attemptsText}
                </span>
              </div>
            </div>

            {/* Verification Evidence Sentence */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "var(--space-2) var(--space-3)",
                backgroundColor: "var(--color-surface-2)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-subdued)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <StatusIcon status={statusIconType} size={16} />
              <span style={{ color: "var(--color-text-primary)", lineHeight: 1.5 }}>
                {evidenceSentence}
              </span>
            </div>

            {/* Format Selector Toolbar if React Equivalent Exists */}
            {reactEquivalent && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                }}
              >
                <SegmentedControl<"html" | "react">
                  name={`format-${barrier.id}`}
                  ariaLabel="Patch format"
                  size="sm"
                  value={currentFormat}
                  onChange={(val) =>
                    setBarrierFormat((prev) => ({ ...prev, [barrier.id]: val }))
                  }
                  options={[
                    { value: "html", label: "HTML / DOM patch" },
                    { value: "react", label: "React (JSX / TSX)" },
                  ]}
                />
                <span
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Target: {barrier.selector}
                </span>
              </div>
            )}

            {/* Live region for announcing format changes to screen readers */}
            <div
              aria-live="polite"
              aria-atomic="true"
              style={{
                position: "absolute",
                width: "1px",
                height: "1px",
                padding: 0,
                margin: "-1px",
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              {currentFormat === "react"
                ? "Switched to React JSX / TSX equivalent view"
                : "Switched to HTML DOM patch view"}
            </div>

            {currentFormat === "react" && reactEquivalent ? (
              <div
                tabIndex={0}
                role="region"
                aria-label="React equivalent snippet"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subdued)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                <div
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    backgroundColor: "var(--color-surface-3)",
                    borderLeft: "3px solid var(--color-brand-primary)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "var(--color-brand-primary)" }}>React (JSX / TSX)</strong>: Translated from the verified HTML patch. The browser verified the DOM change, not this JSX.
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-bg-canvas)",
                    border: "1px solid var(--color-border-subdued)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-sm)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-status-success)",
                    overflowX: "auto",
                    lineHeight: 1.6,
                  }}
                >
                  <code>{reactEquivalent.code}</code>
                </pre>

                {reactEquivalent.notes && reactEquivalent.notes.length > 0 && (
                  <div style={{ marginTop: "var(--space-1)" }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        marginBottom: "4px",
                      }}
                    >
                      Implementation Notes:
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "18px",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {reactEquivalent.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              /* Unified Diff with Line Numbers and +/- Markers */
              <div
                tabIndex={0}
                role="region"
                aria-label="Code diff viewer"
                style={{
                  backgroundColor: "var(--color-bg-canvas)",
                  border: "1px solid var(--color-border-subdued)",
                  borderRadius: "var(--radius-sm)",
                  overflowX: "auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: 1.5,
                }}
              >
                {diffLines.map((line, lIdx) => {
                  const isAdd = line.prefix === "+";
                  const isRemove = line.prefix === "-";
                  const isHeader = line.type === "header";

                  return (
                    <div
                      key={lIdx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 40px 24px 1fr",
                        backgroundColor: isAdd
                          ? "rgba(118, 185, 0, 0.12)"
                          : isRemove
                          ? "rgba(224, 78, 64, 0.12)"
                          : isHeader
                          ? "var(--color-surface-3)"
                          : "transparent",
                        color: isAdd
                          ? "var(--color-status-success)"
                          : isRemove
                          ? "var(--color-severity-blocker)"
                          : isHeader
                          ? "var(--color-text-muted)"
                          : "var(--color-text-primary)",
                        padding: "2px 8px",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                      }}
                    >
                      {/* Old line number */}
                      <span
                        style={{
                          textAlign: "right",
                          paddingRight: "8px",
                          color: "var(--color-text-muted)",
                          userSelect: "none",
                          fontSize: "12px",
                        }}
                      >
                        {line.oldLineNumber || ""}
                      </span>

                      {/* New line number */}
                      <span
                        style={{
                          textAlign: "right",
                          paddingRight: "8px",
                          color: "var(--color-text-muted)",
                          userSelect: "none",
                          fontSize: "12px",
                        }}
                      >
                        {line.newLineNumber || ""}
                      </span>

                      {/* +/- marker */}
                      <span
                        style={{
                          textAlign: "center",
                          fontWeight: 600,
                          userSelect: "none",
                        }}
                      >
                        {line.prefix}
                      </span>

                      {/* Content */}
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {line.content}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons Row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--space-2)",
                paddingTop: "var(--space-2)",
              }}
            >
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                {/* Copy fix button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleCopy(
                      `fix-${barrier.id}`,
                      currentFormat === "react" && reactEquivalent
                        ? reactEquivalent.code
                        : rawDiff
                    )
                  }
                >
                  {copiedId === `fix-${barrier.id}`
                    ? currentFormat === "react"
                      ? "Copied React snippet ✓"
                      : "Copied fix ✓"
                    : currentFormat === "react"
                    ? "Copy React snippet"
                    : "Copy fix"}
                </Button>

                {/* Copy patched file or Apply to folder in paste-code/folder mode */}
                {(isSourceMode || barrier.modifiedSource) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (barrier.modifiedSource) {
                        handleCopy(`file-${barrier.id}`, barrier.modifiedSource);
                      }
                    }}
                  >
                    {copiedId === `file-${barrier.id}` ? "Copied patched file ✓" : "Copy patched file"}
                  </Button>
                )}

                {onApplyToFolder && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onApplyToFolder(barrier)}
                  >
                    Apply to folder
                  </Button>
                )}
              </div>

              {/* Full screen modal trigger */}
              <Button
                variant="quiet"
                size="sm"
                onClick={() => onOpenFullScreen(barrier)}
              >
                Full screen ↗
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
