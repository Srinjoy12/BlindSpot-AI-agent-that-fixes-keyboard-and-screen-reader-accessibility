// fsWalk.ts — Recursive directory traversal, .gitignore filtering,
// framework project detection, and entry page identification.

import type {
  FolderProjectFile,
  FolderCapabilities,
  FrameworkDetectionResult,
} from "./types.js";

const MAX_FILE_BYTES = 200 * 1024; // 200 KB

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".blindspot",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svgz",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".exe",
  ".bin",
  ".dmg",
  ".iso",
  ".wasm",
]);

/**
 * Detects browser capabilities for File System Access API.
 */
export function getFolderCapabilities(): FolderCapabilities {
  const hasFsAccess =
    typeof window !== "undefined" &&
    typeof (window as any).showDirectoryPicker === "function";

  return {
    hasFsAccess,
    mode: hasFsAccess ? "readwrite" : "readonly",
    reason: hasFsAccess
      ? "Full read & write access enabled via browser File System Access API."
      : "Read-only fallback active (browser lacks File System Access API). Changes can be exported as a downloadable .patch file.",
  };
}

/**
 * Compiles simple .gitignore glob lines into an ignore-matching function.
 */
export function parseGitignore(content: string): (relPath: string) => boolean {
  try {
    const rawLines = content.split(/\r?\n/);
    const patterns: RegExp[] = [];

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      // Basic glob to RegExp conversion
      let escaped = line
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]");

      if (line.endsWith("/")) {
        escaped = `(?:^|/)${escaped}`;
      } else {
        escaped = `(?:^|/)${escaped}(?:$|/)`;
      }

      patterns.push(new RegExp(escaped));
    }

    return (relPath: string) => patterns.some((p) => p.test(relPath));
  } catch (err: any) {
    console.warn("Could not parse .gitignore, skipping custom rules:", err.message);
    return () => false;
  }
}

/**
 * Checks whether a relative path or file name should be skipped.
 */
export function shouldExcludeFile(
  relPath: string,
  size?: number,
  options?: { projectKind?: "static" | "react" }
): boolean {
  const segments = relPath.replace(/^\/+/, "").split("/");
  const baseName = segments[segments.length - 1]!;
  const lowerBase = baseName.toLowerCase();

  // Exclude ignored directories
  for (const seg of segments.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(seg)) return true;
  }
  if (EXCLUDED_DIRS.has(baseName)) return true;

  // Sensitive & environment files
  if (lowerBase.startsWith(".env")) return true;
  if (
    lowerBase.endsWith(".pem") ||
    lowerBase.endsWith(".key") ||
    lowerBase.endsWith(".pfx") ||
    lowerBase.endsWith(".p12")
  ) {
    return true;
  }
  if (lowerBase === ".ds_store" || lowerBase === "thumbs.db") return true;

  // Binary extensions
  const dotIndex = baseName.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = baseName.slice(dotIndex).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return true;
  }

  // React mode: only accept .tsx, .jsx, .ts, .js, .css, .scss, .html, package.json
  if (options?.projectKind === "react") {
    const REACT_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js", ".css", ".scss", ".html"]);
    const ext = dotIndex !== -1 ? baseName.slice(dotIndex).toLowerCase() : "";
    const isPkgJson = lowerBase === "package.json";
    if (!REACT_EXTENSIONS.has(ext) && !isPkgJson) {
      return true;
    }
  }

  // Size limit (200 KB)
  if (typeof size === "number" && size > MAX_FILE_BYTES) {
    return true;
  }

  return false;
}

/**
 * Checks if the scanned project is a framework project requiring a dev server/build step.
 */
export function detectFrameworkProject(
  files: FolderProjectFile[]
): FrameworkDetectionResult {
  const hasRootIndexHtml = files.some(
    (f) => f.path === "index.html" || f.path === "./index.html"
  );
  const pkgJsonFile = files.find((f) => f.path === "package.json");

  if (pkgJsonFile && !hasRootIndexHtml) {
    try {
      const parsed = JSON.parse(pkgJsonFile.content);
      const scripts = parsed.scripts || {};
      if (scripts.dev || scripts.start || scripts.build || scripts.serve) {
        return {
          isFrameworkProject: true,
          reason:
            "Framework projects that need a build step are not supported in folder mode.",
        };
      }
    } catch {}
  }

  return { isFrameworkProject: false };
}

/**
 * Recursively walks a FileSystemDirectoryHandle to read all supported project files.
 */
export async function walkDirectoryHandle(
  dirHandle: any,
  basePath: string = "",
  gitignoreMatcher?: (relPath: string) => boolean,
  options?: { projectKind?: "static" | "react" }
): Promise<FolderProjectFile[]> {
  const result: FolderProjectFile[] = [];

  // 1. First pass: look for .gitignore in root if matcher not yet created
  if (!gitignoreMatcher && !basePath) {
    try {
      const gitignoreHandle = await dirHandle.getFileHandle(".gitignore");
      const gitignoreFile = await gitignoreHandle.getFile();
      const content = await gitignoreFile.text();
      gitignoreMatcher = parseGitignore(content);
    } catch {}
  }

  for await (const entry of dirHandle.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (gitignoreMatcher && gitignoreMatcher(entryPath)) {
      continue;
    }

    if (entry.kind === "directory") {
      if (EXCLUDED_DIRS.has(entry.name) || shouldExcludeFile(entryPath, undefined, options)) {
        continue;
      }
      const subFiles = await walkDirectoryHandle(entry, entryPath, gitignoreMatcher, options);
      result.push(...subFiles);
    } else if (entry.kind === "file") {
      if (shouldExcludeFile(entryPath, undefined, options)) {
        continue;
      }
      try {
        const file: File = await entry.getFile();
        if (file.size > MAX_FILE_BYTES) {
          continue;
        }
        const content = await file.text();
        // Check for binary characters
        if (content.includes("\0")) {
          continue;
        }

        result.push({
          path: entryPath,
          file,
          content,
          size: file.size,
          included: true,
        });
      } catch (err: any) {
        console.warn(`Could not read file '${entryPath}':`, err.message);
      }
    }
  }

  // Sort files with index.html first, then alphabetically
  result.sort((a, b) => {
    if (a.path === "index.html") return -1;
    if (b.path === "index.html") return 1;
    return a.path.localeCompare(b.path);
  });

  return result;
}

/**
 * Fallback: walks a FileList from `<input type="file" webkitdirectory>`.
 */
export async function walkWebkitDirectoryFileList(
  fileList: FileList,
  options?: { projectKind?: "static" | "react" }
): Promise<FolderProjectFile[]> {
  const files: File[] = Array.from(fileList);
  const result: FolderProjectFile[] = [];

  // Check for root .gitignore
  let gitignoreMatcher: ((p: string) => boolean) | undefined;
  const gitignoreFile = files.find(
    (f) =>
      f.webkitRelativePath.endsWith("/.gitignore") ||
      f.name === ".gitignore"
  );
  if (gitignoreFile) {
    try {
      const text = await gitignoreFile.text();
      gitignoreMatcher = parseGitignore(text);
    } catch {}
  }

  for (const file of files) {
    // webkitRelativePath starts with "FolderName/path/to/file"
    const parts = file.webkitRelativePath.split("/");
    // Strip root folder name to get internal relative path
    const relPath = parts.slice(1).join("/") || file.name;

    if (gitignoreMatcher && gitignoreMatcher(relPath)) {
      continue;
    }

    if (shouldExcludeFile(relPath, file.size, options)) {
      continue;
    }

    try {
      const content = await file.text();
      if (content.includes("\0")) continue;

      result.push({
        path: relPath,
        file,
        content,
        size: file.size,
        included: true,
      });
    } catch (err: any) {
      console.warn(`Could not read input file '${relPath}':`, err.message);
    }
  }

  result.sort((a, b) => {
    if (a.path === "index.html") return -1;
    if (b.path === "index.html") return 1;
    return a.path.localeCompare(b.path);
  });

  return result;
}
