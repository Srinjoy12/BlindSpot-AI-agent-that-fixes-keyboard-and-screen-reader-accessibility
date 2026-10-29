import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  validateFilePath,
  validateFileSet,
  createFileSetServer,
  loadSourceFileSet,
  auditFileSet,
  closeSharedBrowser,
  type FileSet,
} from "../src/index.js";

describe("FileSet — Path Validation & Security Rules", () => {
  it("rejects path traversal attempts", () => {
    expect(validateFilePath("../secret.txt").valid).toBe(false);
    expect(validateFilePath("foo/../../bar.js").valid).toBe(false);
    expect(validateFilePath("./local.html").valid).toBe(false);
  });

  it("rejects absolute paths on UNIX and Windows", () => {
    expect(validateFilePath("/etc/passwd").valid).toBe(false);
    expect(validateFilePath("C:\\Windows\\System32").valid).toBe(false);
    expect(validateFilePath("D:/projects/app.js").valid).toBe(false);
  });

  it("rejects backslashes and null bytes", () => {
    expect(validateFilePath("src\\app\\index.js").valid).toBe(false);
    expect(validateFilePath("file\0name.js").valid).toBe(false);
  });

  it("rejects sensitive files (.env, .pem, .key, .git, node_modules, .blindspot)", () => {
    expect(validateFilePath(".env").valid).toBe(false);
    expect(validateFilePath(".env.local").valid).toBe(false);
    expect(validateFilePath("secrets/.env.production").valid).toBe(false);
    expect(validateFilePath("certs/server.pem").valid).toBe(false);
    expect(validateFilePath("keys/id_rsa.key").valid).toBe(false);
    expect(validateFilePath(".git/HEAD").valid).toBe(false);
    expect(validateFilePath("node_modules/express/index.js").valid).toBe(false);
    expect(validateFilePath(".blindspot/backup/2026/index.html").valid).toBe(false);
    expect(validateFilePath(".DS_Store").valid).toBe(false);
  });

  it("accepts valid POSIX relative paths and normalizes slashes", () => {
    const res = validateFilePath("src/components/Button.js");
    expect(res.valid).toBe(true);
    expect(res.normalized).toBe("src/components/Button.js");
  });

  it("handles projectKind: 'react' opt-in exclusions for dist/, build/, .next/, and coverage/", () => {
    // With projectKind: "react", build artifact directories are rejected
    expect(validateFilePath("dist/bundle.js", { projectKind: "react" }).valid).toBe(false);
    expect(validateFilePath("build/index.html", { projectKind: "react" }).valid).toBe(false);
    expect(validateFilePath(".next/static/chunks/main.js", { projectKind: "react" }).valid).toBe(false);
    expect(validateFilePath("coverage/lcov-report/index.html", { projectKind: "react" }).valid).toBe(false);

    // Default (no option or static) does not reject build/ unless restricted by sensitive checks
    expect(validateFilePath("src/components/Button.tsx", { projectKind: "react" }).valid).toBe(true);
    expect(validateFilePath("src/components/Button.tsx").valid).toBe(true);
  });
});

describe("FileSet — React Mode Extension Filtering", () => {
  it("restricts file types in React mode to .tsx, .jsx, .ts, .js, .css, .scss, .html, package.json", () => {
    const validReactFiles = [
      { path: "src/App.tsx", content: "export const App = () => null;" },
      { path: "src/button.jsx", content: "export const Btn = () => null;" },
      { path: "src/utils.ts", content: "export const x = 1;" },
      { path: "src/index.js", content: "console.log(1);" },
      { path: "src/styles.css", content: "body { margin: 0; }" },
      { path: "src/theme.scss", content: "$color: red;" },
      { path: "index.html", content: "<div id='root'></div>" },
      { path: "package.json", content: '{"name":"app"}' },
    ];
    const validRes = validateFileSet(validReactFiles, { projectKind: "react" });
    expect(validRes.valid).toBe(true);

    // Disallowed extension in React mode
    const invalidFiles = [
      { path: "src/App.tsx", content: "export const App = () => null;" },
      { path: "docs/readme.txt", content: "Some docs" },
    ];
    const invalidRes = validateFileSet(invalidFiles, { projectKind: "react" });
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.error).toContain("unsupported extension '.txt' for React mode");

    // In default static mode, readme.txt is valid
    const defaultRes = validateFileSet(invalidFiles);
    expect(defaultRes.valid).toBe(true);
  });
});

describe("FileSet — Size, Count, and Binary Limits", () => {
  it("rejects projects with more than 300 files", () => {
    const files = Array.from({ length: 301 }, (_, i) => ({
      path: `file_${i}.html`,
      content: "<p>test</p>",
    }));
    const res = validateFileSet(files);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("300 files");
  });

  it("rejects files exceeding 200 KB per file", () => {
    const largeContent = "a".repeat(205 * 1024);
    const files = [{ path: "index.html", content: largeContent }];
    const res = validateFileSet(files);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("200 KB");
  });

  it("rejects projects exceeding 5 MB total", () => {
    // 30 files * 180 KB = 5.4 MB
    const chunk = "b".repeat(180 * 1024);
    const files = Array.from({ length: 30 }, (_, i) => ({
      path: `page_${i}.html`,
      content: chunk,
    }));
    const res = validateFileSet(files);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("5 MB");
  });

  it("rejects binary files containing null bytes", () => {
    const files = [{ path: "app.bin", content: "hello\0world" }];
    const res = validateFileSet(files);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Binary file detected");
  });

  it("rejects duplicate paths after normalization", () => {
    const files = [
      { path: "src/index.html", content: "<h1>1</h1>" },
      { path: "src//index.html", content: "<h1>2</h1>" },
    ];
    const res = validateFileSet(files);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Duplicate file path");
  });
});

describe("FileSet — Airgapped Ephemeral Server & Sandboxing", () => {
  afterAll(async () => {
    await closeSharedBrowser();
  });

  it("serves static project files with network egress strictly blocked", async () => {
    const fileSet: FileSet = new Map([
      ["index.html", `<!DOCTYPE html><html><body><a id="btn" href="#">Link</a><img src="https://example.com/external.png" /></body></html>`],
      ["styles.css", "body { margin: 0; }"],
    ]);

    const session = await loadSourceFileSet({ fileSet, entryPath: "index.html" });
    try {
      expect(session.localOrigin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

      // Verify external request was intercepted and blocked
      expect(session.blockedRequestsCount).toBeGreaterThanOrEqual(1);

      // Verify the page element was rendered
      const text = await session.page.textContent("#btn");
      expect(text).toBe("Link");
    } finally {
      await session.close();
    }
  }, 20_000);

  it("audits fixtures/local-project and detects the focus outline barrier on #launch-btn", async () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const fixtureDir = path.resolve(repoRoot, "fixtures/local-project");

    const indexHtml = fs.readFileSync(path.join(fixtureDir, "index.html"), "utf-8");
    const stylesCss = fs.readFileSync(path.join(fixtureDir, "styles.css"), "utf-8");
    const scriptJs = fs.readFileSync(path.join(fixtureDir, "script.js"), "utf-8");

    const fileSet: FileSet = new Map([
      ["index.html", indexHtml],
      ["styles.css", stylesCss],
      ["script.js", scriptJs],
    ]);

    const audit = await auditFileSet({
      files: fileSet,
      entryPath: "index.html",
      maxStops: 30,
    });

    try {
      expect(audit.crawlResult.forwardStops.length).toBeGreaterThan(0);
      // Check that detector D3 (focus not visible) flagged #launch-btn
      const d3Hit = audit.hits.find((h) => h.detectorId === "D3" && h.selector.includes("launch-btn"));
      expect(d3Hit).toBeDefined();
    } finally {
      await audit.session.close();
    }
  }, 20_000);
});
