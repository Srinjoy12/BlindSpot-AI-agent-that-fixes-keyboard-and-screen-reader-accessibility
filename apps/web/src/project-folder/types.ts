// types.ts — Types for browser File System Access API and Project Folder mode.

export interface FolderProjectFile {
  path: string;
  file?: File;
  content: string;
  size: number;
  included: boolean;
}

export interface FolderCapabilities {
  hasFsAccess: boolean;
  mode: "readwrite" | "readonly";
  reason: string;
}

export interface FrameworkDetectionResult {
  isFrameworkProject: boolean;
  reason?: string;
}

export interface FolderOperationLog {
  id: string;
  timestamp: string;
  action: "backup" | "write" | "revert" | "error";
  path: string;
  details?: string;
  status: "success" | "warning" | "error";
}

export interface BackupRecord {
  runTimestamp: string;
  files: {
    path: string;
    originalContent: string;
  }[];
}

export interface FolderAuditSessionState {
  directoryHandle: any | null; // FileSystemDirectoryHandle or fake
  folderName: string;
  capabilities: FolderCapabilities;
  files: FolderProjectFile[];
  selectedEntryPath: string;
  backupRecord: BackupRecord | null;
  operationsLog: FolderOperationLog[];
  appliedPaths: Set<string>;
  isReverted: boolean;
}
