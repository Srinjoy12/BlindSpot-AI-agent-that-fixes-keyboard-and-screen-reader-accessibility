// source.ts — In-memory airgapped source loading for pasted HTML/CSS/JS audits.
// Serves content on an ephemeral local origin with strict network egress blocking.

import http from "node:http";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { SourceAuditOptions, SourceSession } from "./types.js";

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
 * Wraps an HTML snippet into a minimal, valid HTML5 document.
 */
export function wrapSnippetHtml(snippet: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pasted Code Snippet Audit</title>
</head>
<body>
  <main>
${snippet}
  </main>
</body>
</html>`;
}

/**
 * Serves an HTML string from an ephemeral in-memory HTTP server on 127.0.0.1:0.
 */
function createEphemeralServer(html: string): Promise<{ server: http.Server; origin: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || "/", "http://127.0.0.1");
      if (parsedUrl.pathname === "/" || parsedUrl.pathname === "/index.html") {
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          // CSP preventing outbound connections
          "Content-Security-Policy": "connect-src 'self'",
        });
        res.end(html);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to obtain ephemeral port for audit server"));
        return;
      }
      const origin = `http://127.0.0.1:${addr.port}`;
      resolve({ server, origin });
    });

    server.on("error", reject);
  });
}

/**
 * Loads pasted source into a freshly isolated browser context.
 * Blocks all outbound network requests (fetch, XHR, images, fonts, scripts, WebSockets).
 */
export async function loadSource(opts: SourceAuditOptions): Promise<SourceSession> {
  const finalHtml = opts.kind === "snippet" ? wrapSnippetHtml(opts.source) : opts.source;
  const { server, origin } = await createEphemeralServer(finalHtml);

  const browser = await getBrowser();
  let blockedCount = 0;

  // Create a completely fresh browser context
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: false,
    permissions: [],
    serviceWorkers: "block",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 BlindSpot-PastedSource/1.0",
  });

  // Intercept and abort every network request outside the local ephemeral origin
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

  // Hard limits: 45 s total scan timeout, kill context on timeout
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
    throw new Error(`Navigation failed or timed out during source load: ${err.message}`);
  }

  // Check in-page socket blocks
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
