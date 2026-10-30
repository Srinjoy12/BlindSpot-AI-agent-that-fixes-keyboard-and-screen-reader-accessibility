import React, { useState, useRef } from "react";
import { Button } from "../components/ui/Button.js";
import { StatusIcon } from "../components/ui/StatusIcon.js";
import {
  getFolderCapabilities,
  walkDirectoryHandle,
  walkWebkitDirectoryFileList,
  detectFrameworkProject,
} from "./fsWalk.js";
import type {
  FolderProjectFile,
  FolderCapabilities,
  FrameworkDetectionResult,
} from "./types.js";

interface FolderPickerProps {
  onStartFolderAudit: (
    files: FolderProjectFile[],
    entryPath: string,
    dirHandle: any | null,
    folderName: string
  ) => void;
  isRunning: boolean;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({
  onStartFolderAudit,
  isRunning,
}) => {
  const [capabilities] = useState<FolderCapabilities>(getFolderCapabilities);
  const [folderName, setFolderName] = useState<string>("");
  const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
  const [files, setFiles] = useState<FolderProjectFile[]>([]);
  const [selectedEntryPath, setSelectedEntryPath] = useState<string>("index.html");
  const [frameworkWarning, setFrameworkWarning] = useState<FrameworkDetectionResult | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);

  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFolderClick = async () => {
    setReadError(null);
    setFrameworkWarning(null);

    if (capabilities.hasFsAccess && typeof (window as any).showDirectoryPicker === "function") {
      try {
        setIsLoadingFolder(true);
        const handle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });

        const name = handle.name || "project-folder";
        setFolderName(name);
        setDirectoryHandle(handle);

        const projectFiles = await walkDirectoryHandle(handle);

        if (projectFiles.length === 0) {
          setReadError("Selected folder is empty or contains no supported web source text files.");
          setFiles([]);
          return;
        }

        const fwCheck = detectFrameworkProject(projectFiles);
        if (fwCheck.isFrameworkProject) {
          setFrameworkWarning(fwCheck);
          setFiles([]);
          return;
        }

        setFiles(projectFiles);
        // Preselect index.html or first available html file
        const htmlFiles = projectFiles.filter(
          (f) => f.path.endsWith(".html") || f.path.endsWith(".htm")
        );
        if (htmlFiles.some((f) => f.path === "index.html")) {
          setSelectedEntryPath("index.html");
        } else if (htmlFiles.length > 0) {
          setSelectedEntryPath(htmlFiles[0]!.path);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // User cancelled picker
          return;
        }
        setReadError(`Could not access folder: ${err.message}`);
      } finally {
        setIsLoadingFolder(false);
      }
    } else {
      // Trigger fallback input
      fallbackInputRef.current?.click();
    }
  };

  const handleFallbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    try {
      setIsLoadingFolder(true);
      setReadError(null);
      setFrameworkWarning(null);
      setDirectoryHandle(null);

      // Guess folder name from first relative path
      const firstRelative = fileList[0]?.webkitRelativePath || "";
      const rootName = firstRelative.split("/")[0] || "project-folder";
      setFolderName(rootName);

      const projectFiles = await walkWebkitDirectoryFileList(fileList);

      if (projectFiles.length === 0) {
        setReadError("Selected folder contains no supported web text files.");
        setFiles([]);
        return;
      }

      const fwCheck = detectFrameworkProject(projectFiles);
      if (fwCheck.isFrameworkProject) {
        setFrameworkWarning(fwCheck);
        setFiles([]);
        return;
      }

      setFiles(projectFiles);
      const htmlFiles = projectFiles.filter(
        (f) => f.path.endsWith(".html") || f.path.endsWith(".htm")
      );
      if (htmlFiles.some((f) => f.path === "index.html")) {
        setSelectedEntryPath("index.html");
      } else if (htmlFiles.length > 0) {
        setSelectedEntryPath(htmlFiles[0]!.path);
      }
    } catch (err: any) {
      setReadError(`Could not read folder: ${err.message}`);
    } finally {
      setIsLoadingFolder(false);
    }
  };

  const handleToggleInclude = (path: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, included: !f.included } : f))
    );
  };

  const handleSelectAll = (included: boolean) => {
    setFiles((prev) => prev.map((f) => ({ ...f, included })));
  };

  const includedFiles = files.filter((f) => f.included);
  const totalIncludedBytes = includedFiles.reduce((acc, f) => acc + f.size, 0);
  const totalIncludedKb = (totalIncludedBytes / 1024).toFixed(1);

  const htmlFiles = files.filter(
    (f) => f.path.endsWith(".html") || f.path.endsWith(".htm")
  );

  const handleSendAndScan = () => {
    if (includedFiles.length === 0 || isRunning) return;
    onStartFolderAudit(includedFiles, selectedEntryPath, directoryHandle, folderName);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      {/* Hidden fallback file input for Firefox/Safari */}
      <input
        ref={fallbackInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in browser engines
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: "none" }}
        onChange={handleFallbackFileChange}
        aria-hidden="true"
      />

      {/* Mode & Capability Notice */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-2) var(--space-3)",
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--font-size-xs)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <StatusIcon
            name={capabilities.hasFsAccess ? "check" : "info"}
            color={capabilities.hasFsAccess ? "var(--color-accent-primary)" : "var(--color-accent-secondary)"}
          />
          <span style={{ color: "var(--color-text-secondary)" }}>
            {capabilities.hasFsAccess
              ? "Browser File System Access API active · Read & direct write enabled"
              : "Read-only fallback mode · Firefox / Safari (patches exported as .patch)"}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-muted)",
            fontSize: "11px",
          }}
        >
          Static HTML/CSS/JS only
        </span>
      </div>

      {/* Folder Selection Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <Button
          id="open-project-folder-btn"
          type="button"
          variant="secondary"
          size="md"
          onClick={handleOpenFolderClick}
          disabled={isRunning || isLoadingFolder}
          aria-label="Select local project folder"
        >
          <StatusIcon name="play" color="currentColor" />
          {files.length > 0 ? "Change project folder…" : "Select project folder…"}
        </Button>

        {folderName && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              backgroundColor: "var(--color-surface-2)",
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-ui)",
            }}
          >
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              Folder:
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              {folderName}
            </span>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-accent-primary)" }}>
              ({files.length} text files)
            </span>
          </div>
        )}
      </div>

      {/* Framework Project Warning Banner */}
      {frameworkWarning && (
        <div
          role="alert"
          style={{
            backgroundColor: "rgba(251, 191, 36, 0.1)",
            border: "1px solid var(--color-severity-major)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <StatusIcon name="warning" color="var(--color-severity-major)" />
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
              Framework Project Detected
            </span>
          </div>
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            {frameworkWarning.reason}
          </p>
          <p
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            Hosted BlindSpot operates in an airgapped sandbox and cannot reach your localhost dev server. Static HTML entry points or built output folders (e.g. dist/) are fully supported.
          </p>
        </div>
      )}

      {/* Error Message Banner */}
      {readError && (
        <div
          role="alert"
          style={{
            backgroundColor: "rgba(255, 122, 122, 0.1)",
            border: "1px solid var(--color-severity-blocker)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-primary)",
          }}
        >
          {readError}
        </div>
      )}

      {/* Review Step: File List & Entry Selection */}
      {files.length > 0 && !frameworkWarning && (
        <div
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          {/* Header Row: Entry Page & Stats */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <label
                htmlFor="folder-entry-select"
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                }}
              >
                Entry page:
              </label>
              <select
                id="folder-entry-select"
                value={selectedEntryPath}
                onChange={(e) => setSelectedEntryPath(e.target.value)}
                style={{
                  backgroundColor: "var(--color-surface-1)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-ui)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-1) var(--space-2)",
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {htmlFiles.map((h) => (
                  <option key={h.path} value={h.path}>
                    {h.path}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-text-muted)",
                }}
              >
                Selected: {includedFiles.length}/{files.length} files ({totalIncludedKb} KB)
              </span>
              <button
                type="button"
                onClick={() => handleSelectAll(includedFiles.length < files.length)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-accent-secondary)",
                  fontSize: "var(--font-size-xs)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                {includedFiles.length < files.length ? "Select all" : "Unselect all"}
              </button>
            </div>
          </div>

          {/* Scrollable File List */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Files to be analyzed"
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-border-subdued)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--font-size-xs)",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--color-surface-3)",
                    borderBottom: "1px solid var(--color-border-subdued)",
                  }}
                >
                  <th style={{ padding: "var(--space-2) var(--space-3)", width: "36px" }}>
                    Include
                  </th>
                  <th style={{ padding: "var(--space-2) var(--space-3)" }}>Path</th>
                  <th style={{ padding: "var(--space-2) var(--space-3)", textAlign: "right" }}>
                    Size
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.path}
                    style={{
                      borderBottom: "1px solid var(--color-border-subdued)",
                      backgroundColor: file.included ? "transparent" : "rgba(0,0,0,0.15)",
                    }}
                  >
                    <td style={{ padding: "var(--space-2) var(--space-3)", textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={file.included}
                        onChange={() => handleToggleInclude(file.path)}
                        aria-label={`Include ${file.path}`}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "var(--space-2) var(--space-3)",
                        fontFamily: "var(--font-mono)",
                        color: file.path === selectedEntryPath ? "var(--color-accent-primary)" : "var(--color-text-primary)",
                      }}
                    >
                      {file.path}
                      {file.path === selectedEntryPath && (
                        <span
                          style={{
                            marginLeft: "var(--space-2)",
                            fontSize: "10px",
                            padding: "1px 4px",
                            borderRadius: "2px",
                            backgroundColor: "rgba(118, 185, 0, 0.15)",
                            color: "var(--color-accent-primary)",
                          }}
                        >
                          Entry
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "var(--space-2) var(--space-3)",
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {(file.size / 1024).toFixed(1)} KB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Privacy & Cloud Processing Notice (Mandatory per PRD) */}
          <div
            style={{
              padding: "var(--space-3)",
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-subdued)",
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
              Privacy & Model Security:{" "}
            </span>
            These files are sent to the BlindSpot server and to NVIDIA Nemotron models on Nebius Token Factory for analysis. They are not stored after the request.
          </div>

          {/* Send and Scan Button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              id="send-folder-audit-btn"
              type="button"
              variant="primary"
              size="md"
              disabled={includedFiles.length === 0 || isRunning}
              onClick={handleSendAndScan}
            >
              {isRunning
                ? "Scanning folder..."
                : `Send ${includedFiles.length} files and scan`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
