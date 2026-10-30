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
    if (!barrier) return;
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
      previousActiveElementRef.current?.focus?.({ preventScroll: true });
    };
  }, [barrier, onClose]);

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
    : [];

  const explanation = barrier.fix?.explanation || barrier.fix?.rationale || "Automated fix generated by Nemotron Ultra.";

  const handleCopyDiff = () => {
    const textToCopy =
      codeFormat === "react" && reactEquivalent
        ? reactEquivalent.code
        : isSourceMode
        ? rawDiff
        : inPagePatchCode;
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
    const blob = new Blob([modifiedSource], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = barrier.filePath ? barrier.filePath.split("/").pop() || "patched-file.html" : "patched-file.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-modal-title"
        className="neo-extruded"
        style={{
          width: "92vw",
          maxWidth: "1000px",
          maxHeight: "90vh",
          backgroundColor: "var(--neo-extruded-bg)",
          boxShadow: "var(--neo-extruded-shadow)",
          border: "var(--neo-extruded-border)",
          borderRadius: "var(--radius-xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          zIndex: 1001,
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "var(--space-4) var(--space-6)",
            borderBottom: "1px solid var(--color-border-subdued)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--color-surface-1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <h2
              id="diff-modal-title"
              style={{
                fontSize: "var(--font-size-xl)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              Verified Fix Inspector
            </h2>

            {(() => {
              const displayPath = barrier.filePath || barrier.fix?.filePath || barrier.likelySource?.path;
              if (!displayPath) return null;
              const isReact = displayPath.endsWith(".tsx") || displayPath.endsWith(".jsx");
              return (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  {isReact && (
                    <span
                      className="neo-pill"
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        color: "var(--color-accent-primary)",
                      }}
                    >
                      React
                    </span>
                  )}
                  <span
                    className="neo-pill"
                    style={{
                      fontSize: "12px",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      padding: "2px 8px",
                      color: "var(--color-accent-primary)",
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
            className="neo-pill"
            style={{
              padding: "6px 14px",
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
            }}
          >
            Esc ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: "var(--space-6)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          {/* Verification Evidence Banner */}
          <div
            className="neo-sunken"
            style={{
              padding: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
              borderLeft: `4px solid ${
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
                gap: "8px",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                color: isVerified
                  ? "var(--color-status-success)"
                  : isRejected
                  ? "var(--color-severity-blocker)"
                  : "var(--color-severity-major)",
                marginBottom: "4px",
              }}
            >
              <StatusIcon status={isVerified ? "success" : isRejected ? "error" : "warning"} size={16} />
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
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
              <SegmentedControl<"unified" | "side-by-side">
                name="diff-view-mode"
                ariaLabel="Diff layout"
                size="sm"
                value={viewMode}
                onChange={(val) => setViewMode(val)}
                options={[
                  { value: "unified", label: "Unified" },
                  { value: "side-by-side", label: "Side by side" },
                ]}
              />
            )}
          </div>

          {/* Explanation Card */}
          <div
            className="neo-extruded"
            style={{
              padding: "var(--space-4)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: "var(--color-text-primary)", marginBottom: "4px" }}>
              Why this fix works:
            </div>
            <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", lineHeight: 1.5, margin: 0 }}>
              {explanation}
            </p>
          </div>

          {/* Diff Viewer Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--space-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  {codeFormat === "react"
                    ? "React (JSX / TSX) Component"
                    : isSourceMode
                    ? "Source code diff with line numbers"
                    : "In-page patch"}
                </span>

                {reactEquivalent && (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
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
                    <div
                      aria-live="polite"
                      className="sr-only"
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
                      {codeFormat === "react" ? "React format selected" : "HTML format selected"}
                    </div>
                  </div>
                )}
              </div>

              <span style={{ fontSize: "var(--font-size-sm)", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                Target: {barrier.selector}
              </span>
            </div>

            {codeFormat === "react" && reactEquivalent ? (
              <div
                tabIndex={0}
                role="region"
                aria-label="React equivalent snippet"
                className="neo-sunken"
                style={{
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  backgroundColor: "#0B1711",
                }}
              >
                <div
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    backgroundColor: "rgba(27, 94, 59, 0.2)",
                    borderLeft: "3px solid var(--color-accent-primary)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "#A3E635" }}>React (JSX / TSX)</strong>: Translated from the verified HTML patch.
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: "var(--space-3)",
                    backgroundColor: "#070E0A",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-sm)",
                    fontFamily: "var(--font-mono)",
                    color: "#A3E635",
                    overflowX: "auto",
                    lineHeight: 1.6,
                  }}
                >
                  <code>{reactEquivalent.code}</code>
                </pre>
              </div>
            ) : isSourceMode && rawDiff ? (
              <div
                tabIndex={0}
                role="region"
                aria-label="Code diff viewer"
                className="neo-sunken"
                style={{
                  backgroundColor: "#0B1711",
                  border: "1px solid rgba(0, 0, 0, 0.4)",
                  borderRadius: "var(--radius-lg)",
                  overflowX: "auto",
                  maxHeight: "360px",
                  padding: "8px 0",
                }}
              >
                {parsedDiff.map((line, lIdx) => {
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
                          ? "rgba(163, 230, 53, 0.14)"
                          : isRemove
                          ? "rgba(239, 68, 68, 0.14)"
                          : isHeader
                          ? "rgba(255, 255, 255, 0.04)"
                          : "transparent",
                        color: isAdd
                          ? "#A3E635"
                          : isRemove
                          ? "#FF7B7B"
                          : isHeader
                          ? "var(--color-text-muted)"
                          : "#F6F4EE",
                        padding: "3px 12px",
                        fontSize: "var(--font-size-sm)",
                        fontFamily: "var(--font-mono)",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ textAlign: "right", paddingRight: "8px", color: "var(--color-text-muted)", userSelect: "none", fontSize: "12px" }}>
                        {line.oldLineNumber || ""}
                      </span>
                      <span style={{ textAlign: "right", paddingRight: "8px", color: "var(--color-text-muted)", userSelect: "none", fontSize: "12px" }}>
                        {line.newLineNumber || ""}
                      </span>
                      <span style={{ textAlign: "center", fontWeight: 700, userSelect: "none" }}>
                        {line.prefix}
                      </span>
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {line.content}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: "var(--space-3)",
                  backgroundColor: "#0B1711",
                  border: "1px solid rgba(0, 0, 0, 0.4)",
                  borderRadius: "var(--radius-lg)",
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                  color: "#A3E635",
                  overflowX: "auto",
                  lineHeight: 1.6,
                }}
              >
                <code>{inPagePatchCode}</code>
              </pre>
            )}
          </div>

          {/* Focus Path Replay Before vs After */}
          {(beforeStops.length > 0 || afterStops.length > 0) && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <h3 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text-primary)", margin: 0 }}>
                  Focus Path Comparison
                </h3>
                <SegmentedControl<"before" | "after">
                  name="modal-path-view"
                  size="sm"
                  value={pathView}
                  onChange={(val) => setPathView(val)}
                  options={[
                    { value: "before", label: `Before (${beforeStops.length} stops)` },
                    { value: "after", label: `After (${afterStops.length} stops)` },
                  ]}
                />
              </div>

              <KeyboardReplay
                stops={pathView === "after" && afterStops.length > 0 ? afterStops : beforeStops}
                barriers={[barrier]}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
