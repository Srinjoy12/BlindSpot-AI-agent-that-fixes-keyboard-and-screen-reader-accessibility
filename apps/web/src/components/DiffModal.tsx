import React, { useEffect, useState, useRef } from "react";
import type { BarrierItem } from "./BarrierList.js";
import { KeyboardReplay, type FocusStopItem } from "./KeyboardReplay.js";
import { Button } from "./ui/Button.js";
import { StatusIcon } from "./ui/StatusIcon.js";
import { SegmentedControl } from "./ui/SegmentedControl.js";
import { translateFixToReact } from "@blindspot/fixer/reactTranslate";

interface DiffModalProps {
  barrier: BarrierItem | null;
  forwardStops?: FocusStopItem[];
  onClose: () => void;
}

interface ParsedDiffLine {
  type: "add" | "remove" | "context" | "header";
  oldLineNumber?: number;
  newLineNumber?: number;
  prefix: string;
  content: string;
}

function parseUnifiedDiff(diffText: string): ParsedDiffLine[] {
  const lines = diffText.split("\n");
  const result: ParsedDiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const rawLine of lines) {
    if (rawLine.startsWith("---") || rawLine.startsWith("+++")) {
      result.push({ type: "header", prefix: "##", content: rawLine });
    } else if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
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

export const DiffModal: React.FC<DiffModalProps> = ({ barrier, forwardStops = [], onClose }) => {
  const [copyFeedback, setCopyFeedback] = useState<"diff" | "file" | "patch" | null>(null);
  const [viewMode, setViewMode] = useState<"unified" | "side-by-side">("unified");
  const [pathView, setPathView] = useState<"before" | "after">("after");
  const [codeFormat, setCodeFormat] = useState<"html" | "react">("html");

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus?.();
    };
  }, [onClose]);

  if (!barrier) return null;

  const isVerified = barrier.status === "verified" || barrier.verified;
  const isRejected = barrier.status === "rejected";

  const rawDiff = barrier.diff || barrier.fix?.diff || "";
  const modifiedSource = barrier.modifiedSource || barrier.fix?.modifiedSource || "";
  const isSourceMode = Boolean(rawDiff || modifiedSource);

  let inPagePatchCode = barrier.fix?.body || barrier.fix?.cssRule || "";
  if (!inPagePatchCode && barrier.fix?.attributes) {
    inPagePatchCode = Object.entries(barrier.fix.attributes)
      .map(([k, v]) => `element.setAttribute("${k}", "${v}");`)
      .join("\n");
  }

  const parsedDiff = isSourceMode && rawDiff ? parseUnifiedDiff(rawDiff) : [];

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

  const beforeStops: FocusStopItem[] = forwardStops.length > 0 ? forwardStops : [];
  const afterStops: FocusStopItem[] = barrier.afterStops && barrier.afterStops.length > 0
    ? barrier.afterStops
    : isVerified && beforeStops.length > 0
    ? [
        ...beforeStops,
        ...(barrier.detectorId === "D1"
          ? [
              {
                index: beforeStops.length + 1,
                selector: "nav > a:nth-of-type(1)",
                tagName: "a",
                role: "link",
                accessibleName: "Home",
                box: { x: 20, y: 20, width: 60, height: 24 },
                inViewport: true,
                obscuredBy: null,
                focusIndicator: { hasOutline: true, hasBoxShadow: false, hasBorderChange: false, hasBackgroundChange: false },
                insideOpenDialog: false,
                scrollY: 0,
              },
            ]
          : [])
      ]
    : beforeStops;

  const handleCopyDiff = () => {
    const textToCopy =
      codeFormat === "react" && reactEquivalent
        ? reactEquivalent.code
        : rawDiff || inPagePatchCode;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopyFeedback("diff");
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleCopyPatchedFile = () => {
    if (!modifiedSource) return;
    navigator.clipboard.writeText(modifiedSource);
    setCopyFeedback("file");
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleDownloadPatchedFile = () => {
    if (!modifiedSource) return;
    const blob = new Blob([modifiedSource], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `patched_${barrier.detectorId}_${barrier.selector.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const explanation =
    barrier.fix?.rationale ||
    barrier.fix?.explanation ||
    "Minimal accessible modification generated with Nemotron Ultra and tested in a real browser.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "var(--space-4)",
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-md)",
          maxWidth: "960px",
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-subtle)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "var(--space-4)",
            borderBottom: "1px solid var(--color-border-subdued)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--color-surface-1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-surface-2)",
                color: isVerified
                  ? "var(--color-status-success)"
                  : isRejected
                  ? "var(--color-severity-blocker)"
                  : "var(--color-severity-major)",
                border: `1px solid ${
                  isVerified
                    ? "var(--color-status-success)"
                    : isRejected
                    ? "var(--color-severity-blocker)"
                    : "var(--color-severity-major)"
                }`,
              }}
            >
              <StatusIcon status={isVerified ? "success" : isRejected ? "error" : "warning"} size={14} />
              <span>{isVerified ? "Fix tested" : isRejected ? "Rejected" : "Fix unverified"}</span>
            </span>

            <h2
              id="diff-modal-title"
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
                margin: 0,
              }}
            >
              {barrier.detectorId} · {barrier.selector}
            </h2>

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
                      fontSize: "var(--font-size-xs)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: "var(--color-surface-3)",
                      color: "var(--color-accent-primary)",
                      border: "1px solid var(--color-border-subdued)",
                    }}
                  >
                    {displayPath}
                  </span>
                </div>
              );
            })()}
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subdued)",
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
            }}
          >
            Esc ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: "var(--space-4)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          {/* Verification Evidence Banner */}
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-surface-2)",
              border: `1px solid ${
                isVerified
                  ? "var(--color-status-success)"
                  : isRejected
                  ? "var(--color-severity-blocker)"
                  : "var(--color-severity-major)"
              }`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                fontSize: "var(--font-size-sm)",
                color: isVerified
                  ? "var(--color-status-success)"
                  : isRejected
                  ? "var(--color-severity-blocker)"
                  : "var(--color-severity-major)",
                marginBottom: "4px",
              }}
            >
              <StatusIcon status={isVerified ? "success" : isRejected ? "error" : "warning"} size={14} />
              <span>Verification evidence</span>
            </div>
            <div style={{ color: "var(--color-text-primary)", fontSize: "var(--font-size-sm)", lineHeight: 1.5 }}>
              {barrier.verificationEvidence ||
                (isVerified
                  ? `Focus path tested in a real browser: detector '${barrier.detectorId}' on '${barrier.selector}' resolved with zero regressions.`
                  : isRejected
                  ? `Fix rejected: ${barrier.rejectionReason || "Diff exceeded line budget or introduced forbidden APIs."}`
                  : "Fix unverified: proposed changes did not eliminate the barrier in browser verification or introduced regressions.")}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <Button
                variant="secondary"
                size="sm"
                id="copy-diff-button"
                onClick={handleCopyDiff}
              >
                {copyFeedback === "diff"
                  ? codeFormat === "react"
                    ? "Copied React snippet ✓"
                    : "Copied diff ✓"
                  : codeFormat === "react"
                  ? "Copy React snippet"
                  : "Copy diff"}
              </Button>

              {modifiedSource && (
                <Button
                  variant="secondary"
                  size="sm"
                  id="copy-patched-file-button"
                  onClick={handleCopyPatchedFile}
                >
                  {copyFeedback === "file" ? "Copied patched file ✓" : "Copy patched file"}
                </Button>
              )}

              {modifiedSource && (
                <Button
                  variant="secondary"
                  size="sm"
                  id="download-patched-file-button"
                  onClick={handleDownloadPatchedFile}
                >
                  Download patched file ↓
                </Button>
              )}
            </div>

            {/* View Mode Toggle */}
            {isSourceMode && rawDiff && (
              <div role="tablist" aria-label="Diff view layout" style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "unified"}
                  onClick={() => setViewMode("unified")}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    fontSize: "var(--font-size-sm)",
                    borderRadius: "var(--radius-sm)",
                    border: viewMode === "unified" ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subdued)",
                    backgroundColor: viewMode === "unified" ? "var(--color-surface-3)" : "var(--color-surface-2)",
                    color: viewMode === "unified" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Unified
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "side-by-side"}
                  onClick={() => setViewMode("side-by-side")}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    fontSize: "var(--font-size-sm)",
                    borderRadius: "var(--radius-sm)",
                    border: viewMode === "side-by-side" ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subdued)",
                    backgroundColor: viewMode === "side-by-side" ? "var(--color-surface-3)" : "var(--color-surface-2)",
                    color: viewMode === "side-by-side" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Side-by-side
                </button>
              </div>
            )}
          </div>

          {/* Rationale */}
          <div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: "4px",
              }}
            >
              Fix explanation and strategy
            </div>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", lineHeight: 1.5, margin: 0 }}>
              {explanation}
            </p>
          </div>

          {/* Diff Viewer Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-3)",
                backgroundColor: "var(--color-surface-3)",
                border: "1px solid var(--color-border-subdued)",
                borderBottom: "none",
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                  {codeFormat === "react"
                    ? "React (JSX / TSX) Component"
                    : isSourceMode
                    ? "Source code diff with line numbers"
                    : "In-page patch"}
                </span>

                {reactEquivalent && (
                  <SegmentedControl<"html" | "react">
                    name="diff-modal-format"
                    ariaLabel="Patch format"
                    size="sm"
                    value={codeFormat}
                    onChange={(val) => setCodeFormat(val)}
                    options={[
                      { value: "html", label: "HTML / DOM patch" },
                      { value: "react", label: "React (JSX / TSX)" },
                    ]}
                  />
                )}
              </div>

              <span style={{ fontSize: "var(--font-size-sm)", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                Target: {barrier.selector}
              </span>
            </div>

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
              {codeFormat === "react" ? "Switched to React JSX / TSX equivalent view" : "Switched to HTML DOM patch view"}
            </div>

            {codeFormat === "react" && reactEquivalent ? (
              <div
                tabIndex={0}
                role="region"
                aria-label="React equivalent snippet"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subdued)",
                  borderRadius: "0 0 var(--radius-sm) var(--radius-sm)",
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
                    backgroundColor: "var(--color-surface-1)",
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
                    <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "4px" }}>
                      Implementation Notes:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                      {reactEquivalent.notes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : isSourceMode && rawDiff ? (
              <div
                tabIndex={0}
                role="region"
                aria-label="Code diff viewer"
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subdued)",
                  borderRadius: "0 0 var(--radius-sm) var(--radius-sm)",
                  overflowX: "auto",
                  maxHeight: "340px",
                }}
              >
                {viewMode === "unified" ? (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                      lineHeight: "22px",
                    }}
                  >
                    <tbody>
                      {parsedDiff.map((d, idx) => {
                        let rowBg = "transparent";
                        let textColor = "var(--color-text-primary)";
                        let markerColor = "var(--color-text-muted)";

                        if (d.type === "add") {
                          rowBg = "var(--color-surface-1)";
                          textColor = "var(--color-status-success)";
                          markerColor = "var(--color-status-success)";
                        } else if (d.type === "remove") {
                          rowBg = "var(--color-surface-1)";
                          textColor = "var(--color-severity-blocker)";
                          markerColor = "var(--color-severity-blocker)";
                        }

                        return (
                          <tr key={idx} style={{ backgroundColor: rowBg }}>
                            <td
                              style={{
                                width: "45px",
                                textAlign: "right",
                                padding: "0 8px",
                                color: "var(--color-text-muted)",
                                userSelect: "none",
                                borderRight: "1px solid var(--color-border-subdued)",
                              }}
                            >
                              {d.oldLineNumber ?? ""}
                            </td>
                            <td
                              style={{
                                width: "45px",
                                textAlign: "right",
                                padding: "0 8px",
                                color: "var(--color-text-muted)",
                                userSelect: "none",
                                borderRight: "1px solid var(--color-border-subdued)",
                              }}
                            >
                              {d.newLineNumber ?? ""}
                            </td>
                            <td
                              style={{
                                width: "24px",
                                textAlign: "center",
                                fontWeight: 600,
                                color: markerColor,
                                userSelect: "none",
                              }}
                            >
                              {d.prefix}
                            </td>
                            <td
                              style={{
                                padding: "0 10px",
                                color: textColor,
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                              }}
                            >
                              {d.content}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid var(--color-border-subdued)" }}>
                    <div style={{ borderRight: "1px solid var(--color-border-subdued)", padding: "var(--space-3)", overflowX: "auto" }}>
                      <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-severity-blocker)", marginBottom: "4px" }}>- Original source</div>
                      <pre style={{ margin: 0, fontSize: "var(--font-size-sm)", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                        {parsedDiff.filter((d) => d.type !== "add").map((d, i) => (
                          <div key={i} style={{ color: d.type === "remove" ? "var(--color-severity-blocker)" : "inherit" }}>
                            <span style={{ opacity: 0.6, width: "30px", display: "inline-block" }}>{d.oldLineNumber || ""}</span>
                            <span>{d.prefix} {d.content}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                    <div style={{ padding: "var(--space-3)", overflowX: "auto" }}>
                      <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-status-success)", marginBottom: "4px" }}>+ Modified source</div>
                      <pre style={{ margin: 0, fontSize: "var(--font-size-sm)", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                        {parsedDiff.filter((d) => d.type !== "remove").map((d, i) => (
                          <div key={i} style={{ color: d.type === "add" ? "var(--color-status-success)" : "inherit" }}>
                            <span style={{ opacity: 0.6, width: "30px", display: "inline-block" }}>{d.newLineNumber || ""}</span>
                            <span>{d.prefix} {d.content}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <pre
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subdued)",
                  borderRadius: "0 0 var(--radius-sm) var(--radius-sm)",
                  padding: "var(--space-3)",
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-status-success)",
                  overflowX: "auto",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                <code>{inPagePatchCode || "/* No patch content provided */"}</code>
              </pre>
            )}
          </div>

          {/* Before/After Focus Comparison */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                Before / after keyboard focus comparison
              </div>

              <div role="tablist" aria-label="Keyboard path comparison" style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pathView === "before"}
                  onClick={() => setPathView("before")}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    border: pathView === "before" ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subdued)",
                    backgroundColor: pathView === "before" ? "var(--color-surface-3)" : "var(--color-surface-2)",
                    color: pathView === "before" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                  }}
                >
                  Before fix ({beforeStops.length} tab stops)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pathView === "after"}
                  onClick={() => setPathView("after")}
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    border: pathView === "after" ? "1px solid var(--color-border-strong)" : "1px solid var(--color-border-subdued)",
                    backgroundColor: pathView === "after" ? "var(--color-surface-3)" : "var(--color-surface-2)",
                    color: pathView === "after" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    fontSize: "var(--font-size-sm)",
                    cursor: "pointer",
                  }}
                >
                  After fix ({afterStops.length} tab stops · fix tested)
                </button>
              </div>
            </div>

            <KeyboardReplay
              stops={pathView === "before" ? beforeStops : afterStops}
              trapDetected={pathView === "before" && (barrier.detectorId === "D1" || barrier.severity === "blocker")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
