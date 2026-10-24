// session.ts — launches and manages a headless Chromium session for one audit.
// Creates a fresh context per audit: no cookies, no storage, no cross-contamination.

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface SessionOptions {
  auditId: string;
  targetUrl: string;
  navigationTimeoutMs?: number; // default: 20_000
  viewportWidth?: number; // default: 1280
  viewportHeight?: number; // default: 800
}

export interface Session {
  page: Page;
  context: BrowserContext;
  browser: Browser;
  close(): Promise<void>;
}

let _browser: Browser | null = null;

async function getSharedBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  return _browser;
}

/** Starts a fresh isolated browser context for one audit. */
export async function startSession(opts: SessionOptions): Promise<Session> {
  const browser = await getSharedBrowser();

  const context = await browser.newContext({
    viewport: {
      width: opts.viewportWidth ?? 1280,
      height: opts.viewportHeight ?? 800,
    },
    // Disable service workers and ensure isolation
    serviceWorkers: "block",
    acceptDownloads: false,
    // Emulate a standard desktop user agent
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 BlindSpot/1.0",
  });

  // Block downloads and popups
  context.on("page", (newPage) => {
    void newPage.close();
  });

  const page = await context.newPage();

  const navTimeout = opts.navigationTimeoutMs ?? 20_000;
  page.setDefaultNavigationTimeout(navTimeout);
  page.setDefaultTimeout(navTimeout);

  // Navigate and wait for stability
  await page.goto(opts.targetUrl, { waitUntil: "domcontentloaded", timeout: navTimeout });

  // Wait for network to be idle and DOM to stabilise for 500ms
  try {
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  } catch {
    // Network may never go fully idle on some pages; continue anyway
  }

  await waitForDomStability(page, 500);

  return {
    page,
    context,
    browser,
    async close() {
      await context.close();
    },
  };
}

/** Polls document.body.innerHTML every 100ms until it stops changing for `stableMs`. */
async function waitForDomStability(page: Page, stableMs: number): Promise<void> {
  let lastHtml = "";
  let stableFor = 0;
  const interval = 100;
  const maxWait = 5_000;
  const deadline = Date.now() + maxWait;

  while (Date.now() < deadline) {
    const html = await page.evaluate(() => document.body?.innerHTML?.length ?? 0);
    if (html === lastHtml) {
      stableFor += interval;
      if (stableFor >= stableMs) return;
    } else {
      stableFor = 0;
      lastHtml = String(html);
    }
    await sleep(interval);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
