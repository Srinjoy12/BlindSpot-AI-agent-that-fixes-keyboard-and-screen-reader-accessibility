import { describe, it, expect } from "vitest";
import {
  FakeFileSystemDirectoryHandle,
} from "./fakeFileSystem.js";
import {
  walkDirectoryHandle,
  detectFrameworkProject,
  shouldExcludeFile,
  parseGitignore,
} from "./fsWalk.js";
import {
  createBackupBeforeRun,
  applyFileFix,
  revertAllFiles,
} from "./folderOps.js";

describe("Project Folder — Directory Traversal & Exclusions", () => {
  it("filters sensitive files, node_modules, .git, and binaries", () => {
    expect(shouldExcludeFile(".env")).toBe(true);
    expect(shouldExcludeFile("secrets/.env.local")).toBe(true);
    expect(shouldExcludeFile("certs/server.key")).toBe(true);
    expect(shouldExcludeFile("node_modules/react/index.js")).toBe(true);
    expect(shouldExcludeFile(".git/config")).toBe(true);
    expect(shouldExcludeFile("assets/image.png")).toBe(true);
    expect(shouldExcludeFile("fonts/inter.woff2")).toBe(true);
    expect(shouldExcludeFile("src/index.html")).toBe(false);
    expect(shouldExcludeFile("styles.css")).toBe(false);
  });

  it("parses .gitignore globs and matches ignored files", () => {
    const gitignoreContent = `
# dependencies
node_modules/
*.log
temp/*
secret-*.txt
`;
    const matcher = parseGitignore(gitignoreContent);
    expect(matcher("debug.log")).toBe(true);
    expect(matcher("temp/scratch.js")).toBe(true);
    expect(matcher("secret-tokens.txt")).toBe(true);
    expect(matcher("src/app.js")).toBe(false);
  });

  it("walks an in-memory directory handle and collects only valid text files", async () => {
    const fakeDir = FakeFileSystemDirectoryHandle.fromFileMap({
      "index.html": "<!DOCTYPE html><html><body><h1>App</h1></body></html>",
      "styles/main.css": "body { margin: 0; }",
      "assets/banner.png": "\0binarydata\0",
      "node_modules/lib/index.js": "console.log('skip');",
      ".env": "SECRET=123",
    });

    const files = await walkDirectoryHandle(fakeDir);
    const paths = files.map((f) => f.path);

    expect(paths).toContain("index.html");
    expect(paths).toContain("styles/main.css");
    expect(paths).not.toContain("assets/banner.png");
    expect(paths).not.toContain("node_modules/lib/index.js");
    expect(paths).not.toContain(".env");
  });

  it("detects framework projects needing a build step", () => {
    const frameworkFiles = [
      {
        path: "package.json",
        content: JSON.stringify({ scripts: { dev: "vite", build: "vite build" } }),
        size: 100,
        included: true,
      },
      {
        path: "src/App.tsx",
        content: "export const App = () => null;",
        size: 50,
        included: true,
      },
    ];

    const result = detectFrameworkProject(frameworkFiles);
    expect(result.isFrameworkProject).toBe(true);
    expect(result.reason).toContain("Framework projects that need a build step are not supported in folder mode.");

    const staticFiles = [
      {
        path: "index.html",
        content: "<h1>Static Site</h1>",
        size: 100,
        included: true,
      },
      {
        path: "package.json",
        content: JSON.stringify({ scripts: { dev: "live-server" } }),
        size: 100,
        included: true,
      },
    ];
    expect(detectFrameworkProject(staticFiles).isFrameworkProject).toBe(false);
  });
});

describe("Project Folder — Backup, Apply, Stale Refusal & Byte-for-Byte Revert", () => {
  it("creates a backup on disk, writes modified content, refuses stale edits, and restores byte-for-byte", async () => {
    const originalHtml = "<button id='btn'>Click</button>";
    const originalCss = "#btn { outline: none; }";
    const fixedCss = "#btn:focus { outline: 2px solid green; }";

    const fakeDir = FakeFileSystemDirectoryHandle.fromFileMap({
      "index.html": originalHtml,
      "styles.css": originalCss,
    });

    // 1. Create backup before run
    const backup = await createBackupBeforeRun(fakeDir, [
      { path: "styles.css", originalContent: originalCss },
    ]);
    expect(backup.files.length).toBe(1);

    // 2. Apply fix to disk
    const applyRes = await applyFileFix(fakeDir, {
      path: "styles.css",
      originalContent: originalCss,
      modifiedContent: fixedCss,
    });
    expect(applyRes.success).toBe(true);

    // Confirm file on disk has changed
    const stylesFileHandle = await fakeDir.getFileHandle("styles.css");
    const writtenFile = await stylesFileHandle.getFile();
    expect(await writtenFile.text()).toBe(fixedCss);

    // 3. Stale check: if a file on disk is modified by user after scan, refuses write
    const staleAttempt = await applyFileFix(fakeDir, {
      path: "styles.css",
      originalContent: originalCss, // Baseline from before
      modifiedContent: "/* Attempt two */",
    });
    expect(staleAttempt.success).toBe(false);
    expect(staleAttempt.isStale).toBe(true);
    expect(staleAttempt.error).toContain("edited on disk");

    // 4. Revert: restores original file from backup and verifies byte-for-byte
    const inMemoryOriginals = new Map([
      ["styles.css", originalCss],
      ["index.html", originalHtml],
    ]);

    const revertRes = await revertAllFiles(fakeDir, backup, inMemoryOriginals);
    expect(revertRes.success).toBe(true);
    expect(revertRes.byteIdentical).toBe(true);
    expect(revertRes.revertedCount).toBe(1);

    // Check disk content is restored byte-identical to original
    const restoredFile = await stylesFileHandle.getFile();
    expect(await restoredFile.text()).toBe(originalCss);
  });
});
