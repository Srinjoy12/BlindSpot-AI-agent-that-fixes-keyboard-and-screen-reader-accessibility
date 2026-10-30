import React, { useState, useRef } from "react";
import { Button } from "./ui/Button.js";
import { StatusIcon } from "./ui/StatusIcon.js";
import { SegmentedControl, type SegmentOption } from "./ui/SegmentedControl.js";
import { FolderPicker } from "../project-folder/FolderPicker.js";
import type { FolderProjectFile } from "../project-folder/types.js";
import {
  getFolderCapabilities,
  walkDirectoryHandle,
  walkWebkitDirectoryFileList,
} from "../project-folder/fsWalk.js";
import { EXAMPLES, CODE_PRESETS } from "../examples.js";

interface AuditBarProps {
  onStartAudit: (target: string, runFixes: boolean, isSourceCode?: boolean, kind?: "html" | "snippet", useReplay?: boolean) => void;
  onStartFolderAudit?: (files: FolderProjectFile[], entryPath: string, dirHandle: any | null, folderName: string) => void;
  onStartLocalDevAudit?: (targetUrl: string, files: FolderProjectFile[], attested: boolean, runFixes: boolean) => void;
  isRunning: boolean;
}

export type InputMode = "url" | "code" | "folder" | "url_folder";

const MODE_OPTIONS: SegmentOption<InputMode>[] = [
  { value: "url", label: "URL", id: "tab-url" },
  { value: "code", label: "Paste code", id: "tab-code" },
  { value: "folder", label: "Open folder", id: "tab-folder" },
  { value: "url_folder", label: "URL + source folder", badge: "Local only", id: "tab-url-folder" },
];

export const AuditBar: React.FC<AuditBarProps> = ({
  onStartAudit,
  onStartFolderAudit,
  onStartLocalDevAudit,
  isRunning,
}) => {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState<string>("/fixtures/B08-cookie-banner.html");
  const [sourceCode, setSourceCode] = useState<string>("");
  const [snippetKind, setSnippetKind] = useState<"html" | "snippet">("html");
  const [runFixes, setRunFixes] = useState<boolean>(true);
  const [attested, setAttested] = useState<boolean>(false);

  // Dev server + source folder mode state
  const [devUrl, setDevUrl] = useState<string>("http://localhost:5173");
  const [devAttested, setDevAttested] = useState<boolean>(false);
  const [devFiles, setDevFiles] = useState<FolderProjectFile[]>([]);
  const [devFolderName, setDevFolderName] = useState<string>("");
  const [devLoadingFiles, setDevLoadingFiles] = useState<boolean>(false);
  const [devFolderError, setDevFolderError] = useState<string | null>(null);

  const fallbackDevInputRef = useRef<HTMLInputElement>(null);

  const [selectedCodePresetId, setSelectedCodePresetId] = useState<string>("");

  const isRemoteHost =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  const selectedUrlExample = EXAMPLES.find((ex) => ex.htmlPath === url);
  const urlPresetValue = selectedUrlExample ? selectedUrlExample.htmlPath : "";

  const handleSelectUrlPreset = (pathOrId: string) => {
    const ex = EXAMPLES.find((item) => item.id === pathOrId || item.htmlPath === pathOrId);
    if (ex) {
      setUrl(ex.htmlPath);
    } else {
      setUrl(pathOrId);
    }
  };

  const handleSelectCodePreset = (presetId: string) => {
    setSelectedCodePresetId(presetId);
    const found = CODE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setSourceCode(found.code);
      setSnippetKind(found.kind);
    }
  };

  const handleOpenDevFolder = async () => {
    setDevFolderError(null);
    const caps = getFolderCapabilities();

    if (caps.hasFsAccess && typeof (window as any).showDirectoryPicker === "function") {
      try {
        setDevLoadingFiles(true);
        const handle = await (window as any).showDirectoryPicker({ mode: "read" });
        const name = handle.name || "src";
        setDevFolderName(name);
        const projectFiles = await walkDirectoryHandle(handle, "", undefined, { projectKind: "react" });
        if (projectFiles.length === 0) {
          setDevFolderError("Selected folder contains no supported React code files (.tsx, .jsx, .ts, .js, .css, .scss, .html).");
          setDevFiles([]);
        } else {
          setDevFiles(projectFiles);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setDevFolderError(`Failed to read folder: ${err.message}`);
        }
      } finally {
        setDevLoadingFiles(false);
      }
    } else {
      fallbackDevInputRef.current?.click();
    }
  };

  const handleDevFallbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setDevFolderError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setDevLoadingFiles(true);
      const projectFiles = await walkWebkitDirectoryFileList(files, { projectKind: "react" });
      if (projectFiles.length === 0) {
        setDevFolderError("Selected folder contains no supported React code files (.tsx, .jsx, .ts, .js, .css, .scss, .html).");
        setDevFiles([]);
      } else {
        const topDir = files[0].webkitRelativePath?.split("/")[0] || "src";
        setDevFolderName(topDir);
        setDevFiles(projectFiles);
      }
    } catch (err: any) {
      setDevFolderError(`Failed to read folder files: ${err.message}`);
    } finally {
      setDevLoadingFiles(false);
    }
  };

  const isLocalFixture = url.startsWith("/fixtures/") || url.startsWith("fixtures/");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) return;

    if (mode === "url") {
      if (!url.trim()) return;
      if (!isLocalFixture && !attested) return;
      onStartAudit(url.trim(), runFixes);
    } else if (mode === "code") {
      if (!sourceCode.trim()) return;
      onStartAudit(sourceCode.trim(), runFixes, true, snippetKind);
    } else if (mode === "url_folder") {
      if (!devUrl.trim() || devFiles.length === 0 || !devAttested) return;
      if (onStartLocalDevAudit) {
        onStartLocalDevAudit(devUrl.trim(), devFiles, devAttested, runFixes);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const codeByteLength = new Blob([sourceCode]).size;
  const isOverLimit = codeByteLength > 100 * 1024;

  const canSubmit =
    !isRunning &&
    ((mode === "url" && url.trim().length > 0 && (isLocalFixture || attested)) ||
      (mode === "code" && sourceCode.trim().length > 0 && !isOverLimit));

  const devCanSubmit =
    !isRunning &&
    !isRemoteHost &&
    mode === "url_folder" &&
    devUrl.trim().length > 0 &&
    devFiles.length > 0 &&
    devAttested;

  return (
    <div
      className="neo-extruded"
      style={{
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
        marginBottom: "var(--space-6)",
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
            {/* Mode Segmented Control: Sunken track with smooth extruded sliding pill */}
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
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "stretch", flexWrap: "wrap" }}>
                <div
                  style={{
                    position: "relative",
                    flex: "1 1 280px",
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
                      fontWeight: 600,
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
                    className="neo-sunken"
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "0 var(--space-3) 0 52px",
                      borderRadius: "var(--radius-md)",
                      color: "var(--color-text-primary)",
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>

                {/* Primary Button: Invoca Green Convex Button */}
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
                      color: "rgba(255, 255, 255, 0.7)",
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
                  gap: "var(--space-3)",
                  flexWrap: "wrap",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                <label
                  htmlFor="examples-select-dropdown"
                  style={{
                    color: "var(--color-text-secondary)",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Presets:
                </label>
                <select
                  id="examples-select-dropdown"
                  aria-label="Select an example URL fixture"
                  value={selectedUrlExample ? selectedUrlExample.id : ""}
                  onChange={(e) => handleSelectUrlPreset(e.target.value)}
                  disabled={isRunning}
                  className="neo-sunken"
                  style={{
                    borderRadius: "var(--radius-md)",
                    color: "var(--color-text-primary)",
                    fontSize: "var(--font-size-sm)",
                    padding: "8px 12px",
                    maxWidth: "420px",
                    cursor: isRunning ? "not-allowed" : "pointer",
                  }}
                >
                  <option value="">Choose an example fixture...</option>
                  {EXAMPLES.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.id}: {ex.title} ({ex.expectedIssues} {ex.expectedIssues === 1 ? "barrier" : "barriers"})
                    </option>
                  ))}
                </select>

                {/* Hidden backward-compatible element with id="url-preset-select" */}
                <select
                  id="url-preset-select"
                  aria-label="Select an example URL fixture (legacy)"
                  value={urlPresetValue}
                  onChange={(e) => handleSelectUrlPreset(e.target.value)}
                  style={{ display: "none" }}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <option value="">Choose an example fixture...</option>
                  {EXAMPLES.map((ex) => (
                    <option key={ex.id} value={ex.htmlPath}>
                      {ex.id}: {ex.title}
                    </option>
                  ))}
                </select>

                {selectedUrlExample && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onStartAudit(selectedUrlExample.htmlPath, runFixes, false, "html", true)}
                    disabled={isRunning}
                  >
                    Run {selectedUrlExample.id}
                  </Button>
                )}

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
                  className="neo-sunken"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-4)",
                    border: attested
                      ? "1px solid var(--color-status-success)"
                      : "1px solid var(--color-severity-major)",
                    borderRadius: "var(--radius-md)",
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
                        fontSize: "var(--font-size-sm)",
                        color: "var(--color-text-secondary)",
                        fontWeight: 600,
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
                      className="neo-sunken"
                      style={{
                        borderRadius: "var(--radius-md)",
                        color: "var(--color-text-primary)",
                        fontSize: "var(--font-size-sm)",
                        padding: "6px 12px",
                        maxWidth: "360px",
                        cursor: isRunning ? "not-allowed" : "pointer",
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
                  className="neo-sunken"
                  style={{
                    width: "100%",
                    padding: "var(--space-3)",
                    border: `1px solid ${isOverLimit ? "var(--color-severity-blocker)" : "var(--color-border-ui)"}`,
                    borderRadius: "var(--radius-md)",
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
                      color: "rgba(255, 255, 255, 0.7)",
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

          {/* URL + Source Folder Mode Panel */}
          {mode === "url_folder" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {isRemoteHost && (
                <div
                  role="note"
                  className="neo-sunken"
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    borderLeft: "3px solid var(--color-brand-primary)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>Localhost Only:</strong> This mode bridges local development servers (<code style={{ fontFamily: "var(--font-mono)" }}>localhost:5173</code>) with source files. Disabled on cloud deployments for SSRF security. For cloud testing, use <strong>URL</strong>, <strong>Paste code</strong>, or <strong>Open folder</strong> mode.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-3)", alignItems: "end" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <label
                    htmlFor="dev-server-url-input"
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Local dev server URL
                  </label>
                  <input
                    id="dev-server-url-input"
                    type="url"
                    value={devUrl}
                    onChange={(e) => setDevUrl(e.target.value)}
                    placeholder="http://localhost:5173"
                    disabled={isRunning}
                    className="neo-sunken"
                    style={{
                      width: "100%",
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--color-text-primary)",
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <input
                    ref={fallbackDevInputRef}
                    id="dev-server-folder-file-input"
                    type="file"
                    /* @ts-expect-error webkitdirectory is a non-standard browser attribute */
                    webkitdirectory="true"
                    directory=""
                    multiple
                    style={{ display: "none" }}
                    onChange={handleDevFallbackFileChange}
                  />
                  <Button
                    id="dev-server-folder-btn"
                    type="button"
                    variant="secondary"
                    onClick={handleOpenDevFolder}
                    disabled={isRunning || devLoadingFiles}
                  >
                    <StatusIcon status={devFiles.length > 0 ? "success" : "info"} size={16} />
                    <span>
                      {devLoadingFiles
                        ? "Scanning folder..."
                        : devFiles.length > 0
                        ? `Attached: ${devFolderName} (${devFiles.length} files)`
                        : "Attach source folder (src/)"}
                    </span>
                  </Button>
                </div>
              </div>

              {devFolderError && (
                <div
                  id="dev-folder-error"
                  role="alert"
                  className="neo-sunken"
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-severity-blocker)",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-severity-blocker)",
                  }}
                >
                  {devFolderError}
                </div>
              )}

              {devFiles.length > 0 && (
                <div
                  id="dev-attached-summary"
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <span>✓ {devFiles.length} source files indexed (.tsx, .jsx, .ts, .css).</span>
                  <span style={{ color: "var(--color-text-muted)" }}>
                    Build artifacts (dist/, .next/) automatically excluded.
                  </span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-3)",
                  paddingTop: "var(--space-2)",
                  borderTop: "1px solid var(--color-border-subdued)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <input
                    id="dev-server-attest-checkbox"
                    type="checkbox"
                    checked={devAttested}
                    onChange={(e) => setDevAttested(e.target.checked)}
                    disabled={isRunning}
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: "var(--color-brand-primary)",
                      cursor: isRunning ? "not-allowed" : "pointer",
                    }}
                  />
                  <label
                    htmlFor="dev-server-attest-checkbox"
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--color-text-secondary)",
                      cursor: isRunning ? "not-allowed" : "pointer",
                    }}
                  >
                    I own or have permission to audit this local development server and attached source folder.
                  </label>
                </div>

                <Button
                  id="btn-audit-dev"
                  type="submit"
                  variant="primary"
                  disabled={!devCanSubmit}
                  title={isRemoteHost ? "Local dev bridge only operates when running locally on localhost:3000" : undefined}
                >
                  <span>
                    {isRunning
                      ? "Running audit..."
                      : isRemoteHost
                      ? "Localhost only"
                      : "Audit dev server"}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontFamily: "var(--font-mono)",
                      color: "rgba(255, 255, 255, 0.7)",
                    }}
                  >
                    ⌘↵
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
