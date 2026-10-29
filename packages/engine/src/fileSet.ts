// fileSet.ts — Shared in-memory FileSet abstraction, security validation,
// and airgapped sandboxed browser execution for static project folders.

import http from "node:http";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { crawl, type CrawlResult } from "./crawl.js";
import { runAxe } from "./axe.js";
import { runInteractionPass } from "./interaction.js";
import { runDetectors, type DetectorHit } from "@blindspot/detectors";
import type {
  FileSet,
  FileInputItem,
  FileSetAuditOptions,
  SourceSession,
  AxeBaselineResult,
} from "./types.js";

const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_COUNT = 300;
const MAX_FILE_BYTES = 200 * 1024; // 200 KB

let _sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_sharedBrowser && _sharedBrowser.isConnected()) return _sharedBrowser;
  _sharedBrowser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  return _sharedBrowser;
}

export async function closeSharedBrowser(): Promise<void> {
  if (_sharedBrowser) {
    await _sharedBrowser.close().catch(() => {});
    _sharedBrowser = null;
  }
}

/**
 * Checks if a relative POSIX path violates security restrictions:
 * - Reject absolute paths (/ or Windows C:\)
 * - Reject backslashes (\)
 * - Reject directory traversal (..)
 * - Reject null bytes (\0)
 * - Reject sensitive files (.env*, *.pem, *.key, .git/*, node_modules/*, .blindspot/*)
 */
export function validateFilePath(rawPath: string): { valid: boolean; normalized?: string; error?: string } {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    return { valid: false, error: "File path must be a non-empty string." };
  }

  if (rawPath.includes("\0")) {
    return { valid: false, error: `File path '${rawPath}' contains prohibited null byte.` };
  }

  if (rawPath.includes("\\")) {
    return { valid: false, error: `File path '${rawPath}' contains backslashes. Only POSIX forward slashes are allowed.` };
  }

  if (rawPath.startsWith("/") || /^[a-zA-Z]:/.test(rawPath)) {
    return { valid: false, error: `Absolute file paths are not permitted: '${rawPath}'.` };
  }

  // Normalize path segments (remove redundant slashes, reject ./ and ..)
  const rawSegments = rawPath.split("/");
  if (rawSegments.includes("..") || rawSegments.includes(".")) {
    return { valid: false, error: `Path traversal or relative dot segments are not permitted: '${rawPath}'.` };
  }

  const cleanSegments = rawSegments.filter((s) => s.length > 0);
  if (cleanSegments.length === 0) {
    return { valid: false, error: `Invalid empty file path: '${rawPath}'.` };
  }

  const normalized = cleanSegments.join("/");
  const baseName = cleanSegments[cleanSegments.length - 1]!;
  const lowerBase = baseName.toLowerCase();
  const lowerNorm = normalized.toLowerCase();

  // Hidden/sensitive checks
  if (lowerBase.startsWith(".env") || lowerNorm.includes("/.env")) {
    return { valid: false, error: `Environment variable files cannot be uploaded: '${rawPath}'.` };
  }

  if (
    lowerBase.endsWith(".pem") ||
    lowerBase.endsWith(".key") ||
    lowerBase.endsWith(".pfx") ||
    lowerBase.endsWith(".p12") ||
    lowerBase.endsWith(".pkcs12")
  ) {
    return { valid: false, error: `Private keys or certificate files cannot be uploaded: '${rawPath}'.` };
  }

  if (
    lowerNorm.startsWith(".git/") ||
    lowerNorm === ".git" ||
    lowerNorm.startsWith("node_modules/") ||
    lowerNorm === "node_modules" ||
    lowerNorm.startsWith(".blindspot/") ||
    lowerNorm === ".blindspot"
  ) {
    return { valid: false, error: `Hidden or restricted directory files cannot be uploaded: '${rawPath}'.` };
  }

  if (lowerBase === ".ds_store" || lowerBase === "thumbs.db") {
    return { valid: false, error: `System metadata files cannot be uploaded: '${rawPath}'.` };
  }

  return { valid: true, normalized };
}

/**
 * Validates a full FileSet or array of file inputs:
 * Enforces total size <= 5MB, count <= 300, per-file <= 200KB, text only, no duplicates.
 */
export function validateFileSet(
  files: FileInputItem[] | FileSet
): { valid: boolean; error?: string; fileSet?: FileSet } {
  const fileList: FileInputItem[] =
    files instanceof Map
      ? Array.from(files.entries()).map(([p, c]) => ({ path: p, content: c }))
      : Array.isArray(files)
      ? files
      : [];

  if (!Array.isArray(fileList) || fileList.length === 0) {
    return { valid: false, error: "No files provided. Please select at least one file." };
  }

  if (fileList.length > MAX_FILE_COUNT) {
    return {
      valid: false,
      error: `Project contains ${fileList.length} files, which exceeds the limit of ${MAX_FILE_COUNT} files.`,
    };
  }

  const normalizedMap: FileSet = new Map();
  let totalBytes = 0;

  for (const item of fileList) {
    if (!item || typeof item.path !== "string" || typeof item.content !== "string") {
      return { valid: false, error: "Invalid file item format: must contain 'path' and 'content' strings." };
    }

    const pathCheck = validateFilePath(item.path);
    if (!pathCheck.valid || !pathCheck.normalized) {
      return { valid: false, error: pathCheck.error || `Invalid path '${item.path}'.` };
    }

    if (normalizedMap.has(pathCheck.normalized)) {
      return { valid: false, error: `Duplicate file path after normalization: '${pathCheck.normalized}'.` };
    }

    // Check for null bytes in content (indicates binary)
    if (item.content.includes("\0")) {
      return {
        valid: false,
        error: `Binary file detected: '${pathCheck.normalized}' contains null bytes. Only UTF-8 text files are supported.`,
      };
    }

    const byteLength = Buffer.byteLength(item.content, "utf8");
    if (byteLength > MAX_FILE_BYTES) {
      const kb = Math.round(byteLength / 1024);
      return {
        valid: false,
        error: `File '${pathCheck.normalized}' is ${kb} KB, exceeding the 200 KB per-file limit.`,
      };
    }

    totalBytes += byteLength;
    if (totalBytes > MAX_TOTAL_BYTES) {
      const mb = (totalBytes / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `Total project size is ${mb} MB, exceeding the 5 MB total project limit.`,
      };
    }

    normalizedMap.set(pathCheck.normalized, item.content);
  }

  return { valid: true, fileSet: normalizedMap };
}

/**
 * Returns appropriate Content-Type header for static files.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".txt":
    case ".md":
      return "text/plain; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    default:
      return "text/plain; charset=utf-8";
  }
}

/**
 * Serves a FileSet from an ephemeral in-memory HTTP server on 127.0.0.1.
 */
export function createFileSetServer(
  fileSet: FileSet,
  entryPath: string = "index.html"
): Promise<{ server: http.Server; origin: string }> {
  return new Promise((resolve, reject) => {
    const normEntry = entryPath.replace(/^\/+/, "");

    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url || "/", "http://127.0.0.1");
        let reqPath = decodeURIComponent(parsedUrl.pathname).replace(/^\/+/, "");

        // Root routes to entryPath
        if (reqPath === "" || reqPath === "/" || reqPath === "index.html") {
          reqPath = normEntry;
        }

        let content = fileSet.get(reqPath);
        if (content === undefined && !fileSet.has(reqPath)) {
          // Try matching without leading segments or case-insensitive if exact match fails
          for (const [k, v] of fileSet.entries()) {
            if (k.toLowerCase() === reqPath.toLowerCase()) {
              content = v;
              reqPath = k;
              break;
            }
          }
        }

        if (content !== undefined) {
          res.writeHead(200, {
            "Content-Type": getMimeType(reqPath),
            "Cache-Control": "no-cache",
            // Strictly enforce no external connections
            "Content-Security-Policy": "connect-src 'self'",
          });
          res.end(content);
        } else {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`Not Found: '${reqPath}'`);
        }
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Server Error: ${err.message}`);
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to allocate ephemeral port for FileSet server."));
        return;
      }
      resolve({ server, origin: `http://127.0.0.1:${addr.port}` });
    });

    server.on("error", reject);
  });
}

/**
 * Loads a FileSet into a freshly isolated browser context.
 * Blocks all outbound network requests outside the local ephemeral origin.
 */
export async function loadSourceFileSet(opts: {
  fileSet: FileSet;
  entryPath?: string;
  navigationTimeoutMs?: number;
}): Promise<SourceSession> {
  const entryPath = opts.entryPath || "index.html";
  const { server, origin } = await createFileSetServer(opts.fileSet, entryPath);

  const browser = await getBrowser();
  let blockedCount = 0;

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: false,
    permissions: [],
    serviceWorkers: "block",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 BlindSpot-FileSet/1.0",
  });

  // Intercept and block any request outside local origin
  await context.route("**", (route, request) => {
    const reqUrl = request.url();
    if (reqUrl.startsWith(origin)) {
      route.continue();
    } else {
      blockedCount++;
      route.abort("blockedbyclient");
    }
  });

  const page = await context.newPage();
  page.on("dialog", (dialog) => {
    dialog.dismiss().catch(() => {});
  });

  // Block popups and new tabs
  context.on("page", (newPage) => {
    if (newPage !== page) {
      void newPage.close().catch(() => {});
    }
  });

  // Track in-page WebSocket attempts
  await page.addInitScript(() => {
    (window as any).__blindspotBlockedSockets = 0;
    try {
      window.WebSocket = class extends EventTarget {
        onerror: any = null;
        constructor() {
          super();
          (window as any).__blindspotBlockedSockets++;
          setTimeout(() => {
            const err = new Event("error");
            this.dispatchEvent(err);
            if (typeof (this as any).onerror === "function") (this as any).onerror(err);
          }, 0);
        }
        close() {}
        send() {}
      } as any;
    } catch {}
  });

  // 45 s hard limit timeout
  const hardTimeoutHandle = setTimeout(async () => {
    try {
      await context.close();
      server.close();
    } catch {}
  }, 45_000);

  const navTimeout = opts.navigationTimeoutMs ?? 10_000;
  page.setDefaultNavigationTimeout(navTimeout);
  page.setDefaultTimeout(navTimeout);

  try {
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: navTimeout });
  } catch (err: any) {
    clearTimeout(hardTimeoutHandle);
    await context.close().catch(() => {});
    server.close();
    throw new Error(`Navigation failed or timed out during FileSet load: ${err.message}`);
  }

  const socketBlocks = await page
    .evaluate(() => (window as any).__blindspotBlockedSockets || 0)
    .catch(() => 0);
  blockedCount += socketBlocks;

  return {
    page,
    context,
    browser,
    localOrigin: origin,
    get blockedRequestsCount() {
      return blockedCount;
    },
    async close() {
      clearTimeout(hardTimeoutHandle);
      try {
        await context.close();
      } finally {
        server.close();
      }
    },
  };
}

/**
 * Audits a FileSet: loads into airgapped browser, runs crawl, detectors, and axe-core baseline.
 */
export async function auditFileSet(opts: FileSetAuditOptions): Promise<{
  crawlResult: CrawlResult;
  hits: DetectorHit[];
  baseline: AxeBaselineResult | null;
  session: SourceSession;
  fileSet: FileSet;
  entryPath: string;
}> {
  const validation = validateFileSet(opts.files);
  if (!validation.valid || !validation.fileSet) {
    throw new Error(validation.error || "Invalid FileSet.");
  }

  const fileSet = validation.fileSet;
  let entryPath = opts.entryPath || "index.html";
  if (!fileSet.has(entryPath)) {
    // If entryPath is missing, pick the first .html file
    const htmlFiles = Array.from(fileSet.keys()).filter((p) => p.endsWith(".html") || p.endsWith(".htm"));
    if (htmlFiles.length > 0) {
      entryPath = htmlFiles[0]!;
    } else {
      throw new Error(`Entry file '${entryPath}' not found in project and no .html files exist.`);
    }
  }

  const session = await loadSourceFileSet({
    fileSet,
    entryPath,
    ...(typeof opts.navigationTimeoutMs === "number"
      ? { navigationTimeoutMs: opts.navigationTimeoutMs }
      : {}),
  });

  try {
    const crawlResult = await crawl(session.page, {
      maxStops: opts.maxStops ?? 60,
      pauseMs: opts.pauseMs ?? 30,
    });

    const candidateData = (await session.page.evaluate(`(() => {
      function getSelector(el) {
        if (el.id) return "#" + CSS.escape(el.id);
        const path = [];
        let current = el;
        while (current && current !== document.body) {
          let seg = current.tagName.toLowerCase();
          if (current.id) { seg = "#" + CSS.escape(current.id); path.unshift(seg); break; }
          const siblings = Array.from(current.parentElement ? current.parentElement.children : []).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) seg += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
          path.unshift(seg);
          current = current.parentElement;
        }
        return path.join(" > ");
      }
      const selectors = [];
      document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [role='tab'], [tabindex], [onclick]").forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;
        const sel = getSelector(el);
        if (sel && !selectors.includes(sel)) selectors.push(sel);
      });
      const hoverTriggers = [];
      document.querySelectorAll(".nav-item, nav li").forEach((item) => {
        const trigger = item.querySelector("a, button");
        const submenu = item.querySelector(".mega-menu, ul, .dropdown-menu, .submenu");
        if (trigger && submenu) {
          const subStyle = window.getComputedStyle(submenu);
          if (subStyle.display === "none") {
            const triggerSel = getSelector(trigger);
            const hasKeyboardOpen = trigger.hasAttribute("aria-haspopup") || trigger.hasAttribute("onclick") || trigger.getAttribute("role") === "button";
            if (!hasKeyboardOpen && triggerSel) hoverTriggers.push(triggerSel);
          }
        }
      });
      return { selectors, hoverTriggers };
    })()`)) as { selectors: string[]; hoverTriggers: string[] };

    const interactionResult = await runInteractionPass(session.page, { count: 1 });

    const hits = runDetectors({
      stateLabel: "S0",
      focusStops: crawlResult.forwardStops,
      interactions: interactionResult.interactions,
      candidateInteractives: candidateData.selectors,
    });

    for (const hoverSel of candidateData.hoverTriggers) {
      if (!hits.some((h) => h.selector === hoverSel && h.detectorId === "D2")) {
        hits.push({
          detectorId: "D2",
          selector: hoverSel,
          stateLabel: "S0",
          stopIndexes: [],
          evidence: `Menu item '${hoverSel}' has a hover-only submenu with no keyboard trigger or aria-haspopup.`,
          confidence: 1,
          severity: "major",
          wcagId: "2.1.1",
        });
      }
    }

    let baseline: AxeBaselineResult | null = null;
    try {
      baseline = await runAxe(session.page);
    } catch {
      baseline = null;
    }

    return {
      crawlResult,
      hits,
      baseline,
      session,
      fileSet,
      entryPath,
    };
  } catch (err) {
    await session.close().catch(() => {});
    throw err;
  }
}
