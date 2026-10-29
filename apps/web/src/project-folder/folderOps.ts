// folderOps.ts — File writing, stale-file verification, automated backup creation,
// byte-for-byte reverts, and patch export fallback.

import type {
  FolderOperationLog,
  BackupRecord,
} from "./types.js";

/**
 * Traverses a FileSystemDirectoryHandle to locate or create a nested file handle.
 */
export async function getFileHandleForPath(
  rootHandle: any,
  relPath: string,
  create: boolean = false
): Promise<{ fileHandle: any; dirHandle: any }> {
  const segments = relPath.replace(/^\/+/, "").split("/");
  let currentDir = rootHandle;

  for (let i = 0; i < segments.length - 1; i++) {
    const dirName = segments[i]!;
    currentDir = await currentDir.getDirectoryHandle(dirName, { create });
  }

  const fileName = segments[segments.length - 1]!;
  const fileHandle = await currentDir.getFileHandle(fileName, { create });
  return { fileHandle, dirHandle: currentDir };
}

/**
 * Ensures backup directory exists and copies original files into:
 * `.blindspot/backup/<ISO-timestamp>/<path>`
 */
export async function createBackupBeforeRun(
  rootHandle: any,
  filesToChange: { path: string; originalContent: string }[]
): Promise<BackupRecord> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (rootHandle && typeof rootHandle.getDirectoryHandle === "function") {
    try {
      const blindspotDir = await rootHandle.getDirectoryHandle(".blindspot", { create: true });
      const backupRootDir = await blindspotDir.getDirectoryHandle("backup", { create: true });
      const runBackupDir = await backupRootDir.getDirectoryHandle(timestamp, { create: true });

      for (const item of filesToChange) {
        const { fileHandle } = await getFileHandleForPath(runBackupDir, item.path, true);
        const writable = await fileHandle.createWritable();
        await writable.write(item.originalContent);
        await writable.close();
      }
    } catch (err: any) {
      console.warn("Could not write backup to disk, falling back to memory backup:", err.message);
    }
  }

  return {
    runTimestamp: timestamp,
    files: filesToChange.map((f) => ({
      path: f.path,
      originalContent: f.originalContent,
    })),
  };
}

export interface ApplyFileFixResult {
  success: boolean;
  path: string;
  isStale?: boolean;
  error?: string;
  log: FolderOperationLog;
}

/**
 * Writes a verified fix to disk after confirming the file has not been modified since the scan.
 */
export async function applyFileFix(
  rootHandle: any,
  item: { path: string; originalContent: string; modifiedContent: string }
): Promise<ApplyFileFixResult> {
  const timestamp = new Date().toISOString();

  if (!rootHandle) {
    return {
      success: false,
      path: item.path,
      error: "No folder handle available for writing.",
      log: {
        id: crypto.randomUUID(),
        timestamp,
        action: "error",
        path: item.path,
        details: "No directory handle granted.",
        status: "error",
      },
    };
  }

  try {
    // 1. Client-side security path check: no traversal, no absolute paths
    if (item.path.includes("..") || item.path.startsWith("/") || item.path.includes("\\")) {
      throw new Error(`Security validation error: path traversal or invalid characters in '${item.path}'.`);
    }

    // 2. Fetch existing file from disk
    const { fileHandle } = await getFileHandleForPath(rootHandle, item.path, false);
    const file = await fileHandle.getFile();
    const diskContent = await file.text();

    // 3. Stale check: verify disk content equals originalContent from the scan
    if (diskContent !== item.originalContent) {
      return {
        success: false,
        path: item.path,
        isStale: true,
        error: `File '${item.path}' has been edited on disk since the audit ran. Please re-scan the folder before applying changes.`,
        log: {
          id: crypto.randomUUID(),
          timestamp,
          action: "error",
          path: item.path,
          details: "Refused: disk content differs from audit baseline (stale file).",
          status: "warning",
        },
      };
    }

    // 4. Write updated content
    const writable = await fileHandle.createWritable();
    await writable.write(item.modifiedContent);
    await writable.close();

    return {
      success: true,
      path: item.path,
      log: {
        id: crypto.randomUUID(),
        timestamp,
        action: "write",
        path: item.path,
        details: `Updated '${item.path}' on disk successfully.`,
        status: "success",
      },
    };
  } catch (err: any) {
    return {
      success: false,
      path: item.path,
      error: err.message,
      log: {
        id: crypto.randomUUID(),
        timestamp,
        action: "error",
        path: item.path,
        details: `Write failed: ${err.message}`,
        status: "error",
      },
    };
  }
}

export interface RevertResult {
  success: boolean;
  revertedCount: number;
  byteIdentical: boolean;
  logs: FolderOperationLog[];
  errors: string[];
}

/**
 * Reverts changes back to the original content from backup or session memory,
 * and verifies byte-for-byte that the restored disk content matches originalContent.
 */
export async function revertAllFiles(
  rootHandle: any,
  backup: BackupRecord | null,
  inMemoryOriginals: Map<string, string>
): Promise<RevertResult> {
  const logs: FolderOperationLog[] = [];
  const errors: string[] = [];
  let revertedCount = 0;
  let allByteIdentical = true;

  const targetFiles = backup
    ? backup.files
    : Array.from(inMemoryOriginals.entries()).map(([path, content]) => ({
        path,
        originalContent: content,
      }));

  for (const item of targetFiles) {
    const timestamp = new Date().toISOString();
    try {
      const { fileHandle } = await getFileHandleForPath(rootHandle, item.path, false);
      const writable = await fileHandle.createWritable();
      await writable.write(item.originalContent);
      await writable.close();

      // Read back to verify byte-for-byte equality
      const verifyFile = await fileHandle.getFile();
      const restoredText = await verifyFile.text();

      if (restoredText !== item.originalContent) {
        allByteIdentical = false;
        errors.push(`Byte mismatch after revert in '${item.path}'.`);
        logs.push({
          id: crypto.randomUUID(),
          timestamp,
          action: "revert",
          path: item.path,
          details: "Restored from backup, but byte-for-byte check detected divergence.",
          status: "warning",
        });
      } else {
        revertedCount++;
        logs.push({
          id: crypto.randomUUID(),
          timestamp,
          action: "revert",
          path: item.path,
          details: "Restored from backup byte-for-byte.",
          status: "success",
        });
      }
    } catch (err: any) {
      allByteIdentical = false;
      errors.push(`Failed to revert '${item.path}': ${err.message}`);
      logs.push({
        id: crypto.randomUUID(),
        timestamp,
        action: "error",
        path: item.path,
        details: `Revert failed: ${err.message}`,
        status: "error",
      },);
    }
  }

  return {
    success: errors.length === 0,
    revertedCount,
    byteIdentical: allByteIdentical,
    logs,
    errors,
  };
}

/**
 * Downloads a combined git-apply unified patch file for read-only browser fallback.
 */
export function downloadUnifiedPatch(
  diffs: { path: string; diff: string }[],
  projectName: string = "blindspot-fixes"
): void {
  const combinedPatch = diffs
    .map((d) => `# Patch for ${d.path}\n${d.diff.trim()}\n`)
    .join("\n\n");

  const blob = new Blob([combinedPatch], { type: "text/x-diff;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectName}.patch`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
