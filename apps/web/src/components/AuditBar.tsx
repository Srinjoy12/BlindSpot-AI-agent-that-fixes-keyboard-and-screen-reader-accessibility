import React, { useState } from "react";
import { Button } from "./ui/Button.js";
import { StatusIcon } from "./ui/StatusIcon.js";
import { SegmentedControl, type SegmentOption } from "./ui/SegmentedControl.js";
import { FolderPicker } from "../project-folder/FolderPicker.js";
import type { FolderProjectFile } from "../project-folder/types.js";
import { EXAMPLES, CODE_PRESETS } from "../examples.js";

interface AuditBarProps {
  onStartAudit: (target: string, runFixes: boolean, isSourceCode?: boolean, kind?: "html" | "snippet") => void;
  onStartFolderAudit?: (files: FolderProjectFile[], entryPath: string, dirHandle: any | null, folderName: string) => void;
  isRunning: boolean;
}

export type InputMode = "url" | "code" | "folder";

const MODE_OPTIONS: SegmentOption<InputMode>[] = [
  { value: "url", label: "URL" },
  { value: "code", label: "Paste code" },
  { value: "folder", label: "Open folder" },
];

export const AuditBar: React.FC<AuditBarProps> = ({
  onStartAudit,
  onStartFolderAudit,
  isRunning,
}) => {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState<string>("/fixtures/B08-cookie-banner.html");
  const [sourceCode, setSourceCode] = useState<string>("");
  const [snippetKind, setSnippetKind] = useState<"html" | "snippet">("html");
  const [runFixes, setRunFixes] = useState<boolean>(true);
  const [attested, setAttested] = useState<boolean>(false);

  const [selectedCodePresetId, setSelectedCodePresetId] = useState<string>("");

  const selectedUrlExample = EXAMPLES.find((ex) => ex.htmlPath === url);
  const urlPresetValue = selectedUrlExample ? selectedUrlExample.htmlPath : "";

  const handleSelectUrlPreset = (path: string) => {
    setUrl(path);
  };

  const handleSelectCodePreset = (presetId: string) => {
    setSelectedCodePresetId(presetId);
    const found = CODE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setSourceCode(found.code);
      setSnippetKind(found.kind);
    }
  };

  const isLocalFixture = url.startsWith("/fixtures/") || url.includes("localhost") || url.includes("127.0.0.1");
  const codeByteLength = new TextEncoder().encode(sourceCode).length;
  const isOverLimit = codeByteLength > 100 * 1024;
  const isCodeValid = sourceCode.trim().length > 0 && !isOverLimit;
  const canSubmit = !isRunning && (mode === "url" ? url.trim().length > 0 && (isLocalFixture || attested) : isCodeValid);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;
    if (mode === "code") {
      onStartAudit(sourceCode, runFixes, true, snippetKind);
    } else {
      onStartAudit(url.trim(), runFixes, false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
      onKeyDown={handleKeyDown}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Top Bar: SegmentedControl & Plain-words Checkbox */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            {/* SegmentedControl designed so "Open folder" can be added without layout shifts */}
            <SegmentedControl
              name="audit-input-mode"
              ariaLabel="Audit input method"
              role="tablist"
              options={MODE_OPTIONS}
              value={mode}
              onChange={(newMode) => setMode(newMode)}
              size="md"
            />

            {/* Checkbox with plain words: "Suggest fixes and test them" */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                id="enable-ultra-fix-checkbox"
                checked={runFixes}
                onChange={(e) => setRunFixes(e.target.checked)}
                style={{
                  accentColor: "var(--color-accent-primary)",
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                }}
              />
              <span>Suggest fixes and test them</span>
            </label>
          </div>

          {/* Mode 1: URL Input Row */}
          {mode === "url" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "stretch", flexWrap: "wrap" }}>
                <div
                  style={{
                    position: "relative",
                    flex: "1 1 200px",
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <label
                    htmlFor="target-url-input"
                    style={{
                      position: "absolute",
                      left: "var(--space-3)",
                      fontSize: "var(--font-size-sm)",
                      color: "var(--color-text-muted)",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    URL
                  </label>
                  <input
                    id="target-url-input"
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    disabled={isRunning}
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "0 var(--space-3) 0 48px",
                      backgroundColor: "var(--color-surface-2)",
                      border: "1px solid var(--color-border-ui)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--color-text-primary)",
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>

                {/* Primary Button: "Run audit" with muted keyboard hint */}
                <Button
                  id="audit-submit-button"
                  type="submit"
                  variant="primary"
                  disabled={!canSubmit}
                  title={
                    !canSubmit && !isLocalFixture && !attested
                      ? "Attestation required for non-fixture URLs"
                      : ""
                  }
                >
                  <span>{isRunning ? "Running audit..." : "Run audit"}</span>
                  <span
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-muted)",
                      opacity: 0.8,
                    }}
                  >
                    ⌘↵
                  </span>
                </Button>
              </div>

              {/* URL Presets Dropdown */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                  fontSize: "var(--font-size-xs)",
                }}
              >
                <label
                  htmlFor="url-preset-select"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  Presets:
                </label>
                <select
                  id="url-preset-select"
                  aria-label="Select an example URL fixture"
                  value={urlPresetValue}
                  onChange={(e) => handleSelectUrlPreset(e.target.value)}
                  disabled={isRunning}
                  style={{
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border-ui)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text-primary)",
                    fontSize: "var(--font-size-xs)",
                    padding: "6px 10px",
                    maxWidth: "420px",
                    cursor: isRunning ? "not-allowed" : "pointer",
                    outline: "none",
                  }}
                >
                  <option value="">Choose an example fixture...</option>
                  {EXAMPLES.map((ex) => (
                    <option key={ex.id} value={ex.htmlPath}>
                      {ex.id}: {ex.title} ({ex.expectedIssues} {ex.expectedIssues === 1 ? "barrier" : "barriers"})
                    </option>
                  ))}
                </select>
                {selectedUrlExample && (
                  <span
                    style={{
                      color: "var(--color-text-muted)",
                      fontSize: "var(--font-size-xs)",
                      fontStyle: "italic",
                      flex: "1 1 200px",
                    }}
                  >
                    {selectedUrlExample.whatsWrong}
                  </span>
                )}
              </div>

              {/* Ownership Attestation for Non-Local URLs */}
              {!isLocalFixture && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-surface-2)",
                    border: attested
                      ? "1px solid var(--color-status-success)"
                      : "1px solid var(--color-severity-major)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <input
                    type="checkbox"
                    id="ownership-attestation-checkbox"
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    disabled={isRunning}
                    style={{
                      accentColor: "var(--color-accent-primary)",
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                    }}
                  />
                  <label
                    htmlFor="ownership-attestation-checkbox"
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: attested ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <strong>Ownership attestation:</strong> I confirm authorization to test this target domain for accessibility barriers.
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Paste Code */}
          {mode === "code" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                    <span>Format:</span>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="snippetKind"
                        checked={snippetKind === "html"}
                        onChange={() => setSnippetKind("html")}
                        disabled={isRunning}
                      />
                      Full HTML
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="snippetKind"
                        checked={snippetKind === "snippet"}
                        onChange={() => setSnippetKind("snippet")}
                        disabled={isRunning}
                      />
                      Snippet
                    </label>
                  </div>

                  {/* Code Presets Dropdown */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <label
                      htmlFor="code-preset-select"
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--color-text-secondary)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Presets:
                    </label>
                    <select
                      id="code-preset-select"
                      aria-label="Select an example code snippet"
                      value={selectedCodePresetId}
                      onChange={(e) => handleSelectCodePreset(e.target.value)}
                      disabled={isRunning}
                      style={{
                        backgroundColor: "var(--color-surface-2)",
                        border: "1px solid var(--color-border-ui)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--color-text-primary)",
                        fontSize: "var(--font-size-xs)",
                        padding: "6px 10px",
                        maxWidth: "360px",
                        cursor: isRunning ? "not-allowed" : "pointer",
                        outline: "none",
                      }}
                    >
                      <option value="">Choose an example snippet...</option>
                      {CODE_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.kind === "html" ? "HTML" : "Snippet"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  id="char-counter"
                  aria-live="polite"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontFamily: "var(--font-mono)",
                    color: isOverLimit ? "var(--color-severity-blocker)" : "var(--color-text-muted)",
                    fontWeight: isOverLimit ? 600 : 400,
                  }}
                >
                  {sourceCode.length} characters · {(codeByteLength / 1024).toFixed(1)} KB of 100 KB limit
                  {isOverLimit && " — Exceeds limit"}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <label
                  htmlFor="pasted-source-input"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Source code
                </label>
                <textarea
                  id="pasted-source-input"
                  aria-describedby="airgap-notice char-counter"
                  value={sourceCode}
                  onChange={(e) => {
                    setSourceCode(e.target.value);
                    if (selectedCodePresetId) {
                      const found = CODE_PRESETS.find((p) => p.id === selectedCodePresetId);
                      if (found && found.code !== e.target.value) {
                        setSelectedCodePresetId("");
                      }
                    }
                  }}
                  placeholder={
                    snippetKind === "snippet"
                      ? '<button class="subscribe-btn">Subscribe</button>\n<div role="dialog">\n  <button>Close</button>\n</div>'
                      : '<!DOCTYPE html>\n<html lang="en">\n<head><title>My app</title></head>\n<body>\n  <button id="btn">Click me</button>\n</body>\n</html>'
                  }
                  disabled={isRunning}
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    backgroundColor: "var(--color-surface-2)",
                    border: `1px solid ${isOverLimit ? "var(--color-severity-blocker)" : "var(--color-border-ui)"}`,
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text-primary)",
                    fontSize: "var(--font-size-sm)",
                    fontFamily: "var(--font-mono)",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-3)",
                }}
              >
                <div
                  id="airgap-notice"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <StatusIcon status="info" size={16} />
                  <span>Self-contained HTML/CSS/JS only. External files and network calls are blocked.</span>
                </div>

                <Button
                  id="audit-submit-code-button"
                  type="submit"
                  variant="primary"
                  disabled={!canSubmit}
                >
                  <span>{isRunning ? "Running audit..." : "Run audit"}</span>
                  <span
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-text-muted)",
                      opacity: 0.8,
                    }}
                  >
                    ⌘↵
                  </span>
                </Button>
              </div>
            </div>
          )}

          {/* Folder Mode Panel */}
          {mode === "folder" && onStartFolderAudit && (
            <FolderPicker
              onStartFolderAudit={onStartFolderAudit}
              isRunning={isRunning}
            />
          )}
        </div>
      </form>
    </div>
  );
};
