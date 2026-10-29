import React, { useState } from "react";
import { Button } from "../components/ui/Button.js";
import { StatusIcon } from "../components/ui/StatusIcon.js";
import {
  createBackupBeforeRun,
  applyFileFix,
  revertAllFiles,
  downloadUnifiedPatch,
} from "./folderOps.js";
import type {
  FolderCapabilities,
  FolderOperationLog,
  BackupRecord,
} from "./types.js";

interface FolderActionToolbarProps {
  directoryHandle: any | null;
  capabilities: FolderCapabilities;
  edits: Array<{
    path: string;
    original: string;
    modified: string;
    unifiedDiff: string;
    status: "verified" | "unverified" | "rejected";
    findingIds?: string[];
    explanation?: string;
  }>;
  inMemoryOriginals: Map<string, string>;
  onRescanFolder: () => void;
  folderName: string;
}

export const FolderActionToolbar: React.FC<FolderActionToolbarProps> = ({
  directoryHandle,
  capabilities,
  edits,
  inMemoryOriginals,
  onRescanFolder,
  folderName,
}) => {
  const [logs, setLogs] = useState<FolderOperationLog[]>([]);
  const [backupRecord, setBackupRecord] = useState<BackupRecord | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [isReverting, setIsReverting] = useState<boolean>(false);
  const [appliedPaths, setAppliedPaths] = useState<Set<string>>(new Set());
  const [isReverted, setIsReverted] = useState<boolean>(false);
  const [showLogDrawer, setShowLogDrawer] = useState<boolean>(false);

  // Unverified confirmation dialog state
  const [unverifiedConfirmEdit, setUnverifiedConfirmEdit] = useState<any | null>(null);

  const verifiedEdits = edits.filter((e) => e.status === "verified");
  const hasWritableHandle = Boolean(directoryHandle && capabilities.hasFsAccess);

  // Apply all verified fixes
  const handleApplyAllVerified = async () => {
    if (!hasWritableHandle || verifiedEdits.length === 0 || isApplying) return;

    try {
      setIsApplying(true);
      const filesToChange = verifiedEdits.map((e) => ({
        path: e.path,
        originalContent: inMemoryOriginals.get(e.path) || e.original,
      }));

      // Create automated backup in .blindspot/backup/<timestamp>/<path>
      const backup = await createBackupBeforeRun(directoryHandle, filesToChange);
      setBackupRecord(backup);

      const newLogs: FolderOperationLog[] = [
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          action: "backup",
          path: `.blindspot/backup/${backup.runTimestamp}/`,
          details: `Created safety backup of ${filesToChange.length} file(s) before applying patches.`,
          status: "success",
        },
      ];

      const newlyApplied = new Set(appliedPaths);

      for (const edit of verifiedEdits) {
        const res = await applyFileFix(directoryHandle, {
          path: edit.path,
          originalContent: inMemoryOriginals.get(edit.path) || edit.original,
          modifiedContent: edit.modified,
        });

        newLogs.push(res.log);
        if (res.success) {
          newlyApplied.add(edit.path);
        }
      }

      setAppliedPaths(newlyApplied);
      setLogs((prev) => [...prev, ...newLogs]);
      setIsReverted(false);
      setShowLogDrawer(true);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          action: "error",
          path: "batch-apply",
          details: `Error applying fixes: ${err.message}`,
          status: "error",
        },
      ]);
    } finally {
      setIsApplying(false);
    }
  };

  // Apply a single fix (verified or unverified after confirmation)
  const handleApplySingle = async (edit: any, forceUnverified = false) => {
    if (!hasWritableHandle || isApplying) return;

    if (edit.status !== "verified" && !forceUnverified) {
      setUnverifiedConfirmEdit(edit);
      return;
    }

    try {
      setIsApplying(true);
      const origContent = inMemoryOriginals.get(edit.path) || edit.original;

      // Ensure backup exists
      const backup =
        backupRecord ||
        (await createBackupBeforeRun(directoryHandle, [
          { path: edit.path, originalContent: origContent },
        ]));
      setBackupRecord(backup);

      const res = await applyFileFix(directoryHandle, {
        path: edit.path,
        originalContent: origContent,
        modifiedContent: edit.modified,
      });

      setLogs((prev) => [...prev, res.log]);
      if (res.success) {
        setAppliedPaths((prev) => new Set([...prev, edit.path]));
        setIsReverted(false);
      }
      setShowLogDrawer(true);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          action: "error",
          path: edit.path,
          details: err.message,
          status: "error",
        },
      ]);
    } finally {
      setIsApplying(false);
      setUnverifiedConfirmEdit(null);
    }
  };

  // Revert all modified files back to original baseline
  const handleRevert = async () => {
    if (!hasWritableHandle || isReverting) return;

    try {
      setIsReverting(true);
      const revertRes = await revertAllFiles(directoryHandle, backupRecord, inMemoryOriginals);

      setLogs((prev) => [...prev, ...revertRes.logs]);

      if (revertRes.success && revertRes.byteIdentical) {
        setAppliedPaths(new Set());
        setIsReverted(true);
      }
      setShowLogDrawer(true);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          action: "error",
          path: "revert",
          details: err.message,
          status: "error",
        },
      ]);
    } finally {
      setIsReverting(false);
    }
  };

  const handleDownloadPatch = () => {
    const diffItems = edits.map((e) => ({ path: e.path, diff: e.unifiedDiff }));
    downloadUnifiedPatch(diffItems, folderName || "blindspot-patches");
  };

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        marginTop: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {/* Top Action Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <StatusIcon name="terminal" color="var(--color-accent-primary)" />
          <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
            Project Folder Actions
          </span>
          {appliedPaths.size > 0 && (
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(52, 211, 153, 0.2)",
                color: "var(--color-status-success)",
                fontWeight: 600,
              }}
            >
              {appliedPaths.size} file(s) applied
            </span>
          )}
          {isReverted && (
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "rgba(96, 165, 250, 0.2)",
                color: "var(--color-text-primary)",
                fontWeight: 600,
              }}
            >
              Reverted byte-for-byte
            </span>
          )}
        </div>

        {/* Buttons Group */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {hasWritableHandle ? (
            <>
              {appliedPaths.size === 0 ? (
                <Button
                  id="apply-all-fixes-btn"
                  variant="primary"
                  size="md"
                  onClick={handleApplyAllVerified}
                  disabled={verifiedEdits.length === 0 || isApplying}
                  aria-label="Apply all verified fixes directly to project folder"
                >
                  <StatusIcon name="check" color="currentColor" />
                  Apply all verified fixes ({verifiedEdits.length})
                </Button>
              ) : (
                <Button
                  id="revert-fixes-btn"
                  variant="secondary"
                  size="md"
                  onClick={handleRevert}
                  disabled={isReverting}
                  aria-label="Revert changes from backup"
                >
                  Revert changes
                </Button>
              )}

              <Button
                id="rescan-folder-btn"
                variant="secondary"
                size="md"
                onClick={onRescanFolder}
                aria-label="Re-scan folder from disk"
              >
                Re-scan folder from disk
              </Button>
            </>
          ) : (
            <Button
              id="download-patch-btn"
              variant="primary"
              size="md"
              onClick={handleDownloadPatch}
              aria-label="Download patch file"
            >
              Download patch (.patch)
            </Button>
          )}

          {logs.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowLogDrawer(!showLogDrawer)}
              aria-expanded={showLogDrawer}
              aria-label="Toggle operations log"
            >
              {showLogDrawer ? "Hide log" : `Log (${logs.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* Operations Log Viewer */}
      {showLogDrawer && logs.length > 0 && (
        <div
          role="region"
          aria-label="File operation log"
          tabIndex={0}
          style={{
            maxHeight: "160px",
            overflowY: "auto",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--font-size-xs)",
            fontFamily: "var(--font-mono)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                color:
                  log.status === "error"
                    ? "var(--color-severity-blocker)"
                    : log.status === "warning"
                    ? "var(--color-severity-major)"
                    : "var(--color-text-secondary)",
              }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span style={{ fontWeight: 600 }}>[{log.action.toUpperCase()}]</span>
              <span>{log.path}:</span>
              <span>{log.details}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Unverified / Rejected Confirmation */}
      {unverifiedConfirmEdit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-unverified-title"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--space-4)",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-severity-major)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-6)",
              maxWidth: "500px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <StatusIcon name="warning" color="var(--color-severity-major)" />
              <h2
                id="confirm-unverified-title"
                style={{
                  fontSize: "var(--font-size-lg)",
                  margin: 0,
                  color: "var(--color-text-primary)",
                }}
              >
                Apply Unverified Fix?
              </h2>
            </div>

            <p
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              This proposed fix for <code style={{ fontFamily: "var(--font-mono)" }}>{unverifiedConfirmEdit.path}</code> was{" "}
              <strong>not verified</strong> in our airgapped browser simulation. It may not fully resolve the accessibility barrier or could alter other layout behaviors.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--space-3)",
              }}
            >
              <Button
                variant="secondary"
                size="md"
                onClick={() => setUnverifiedConfirmEdit(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="md"
                style={{
                  borderColor: "var(--color-severity-major)",
                  color: "var(--color-severity-major)",
                }}
                onClick={() => handleApplySingle(unverifiedConfirmEdit, true)}
              >
                Apply anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
