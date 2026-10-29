// source.test.ts — Tests for in-memory source loading and airgapped route interception.

import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { loadSource, wrapSnippetHtml } from "../src/index.js";
import { crawl } from "../src/crawl.js";
import { runDetectors } from "@blindspot/detectors";

describe("source loading & airgap egress blocking", () => {
  it("wraps snippet into a minimal HTML5 document with lang='en', title, and main", () => {
    const wrapped = wrapSnippetHtml("<button>Click Me</button>");
    expect(wrapped).toContain('<!DOCTYPE html>');
    expect(wrapped).toContain('<html lang="en">');
    expect(wrapped).toContain('<title>');
    expect(wrapped).toContain('<main>');
    expect(wrapped).toContain("<button>Click Me</button>");
    expect(wrapped).toContain('</main>');
  });

  it("blocks all external network egress (fetch, img, WebSocket) and increments blockedRequestsCount", async () => {
    const hostileHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Airgap Egress Test</title></head>
      <body>
        <main>
          <h1>Egress Block Test</h1>
          <img src="http://example.com/untrusted-image.png" alt="Untrusted">
          <script>
            try { fetch("http://169.254.169.254/latest/meta-data/"); } catch(e) {}
            try { new WebSocket("ws://example.com/stream"); } catch(e) {}
          </script>
        </main>
      </body>
      </html>
    `;

    const session = await loadSource({
      source: hostileHtml,
      kind: "html",
      navigationTimeoutMs: 5000,
    });

    try {
      // Allow async scripts a moment to trigger network calls
      await session.page.waitForTimeout(300);
      expect(session.blockedRequestsCount).toBeGreaterThanOrEqual(2);
    } finally {
      await session.close();
    }
  });

  it("terminates infinite loop while(true){} script via navigation timeout without hanging", async () => {
    const infiniteLoopHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Hanging Script</title>
        <script>
          // Infinite loop blocking main thread
          while(true) {}
        </script>
      </head>
      <body><main>Never loads</main></body>
      </html>
    `;

    const start = Date.now();
    await expect(
      loadSource({
        source: infiniteLoopHtml,
        kind: "html",
        navigationTimeoutMs: 1500,
      })
    ).rejects.toThrow(/timed out|Navigation failed/);

    const elapsed = Date.now() - start;
    // Ensure it failed promptly around 1.5-3s rather than hanging
    expect(elapsed).toBeLessThan(5000);
  });

  it("auditing B01 source code directly reproduces the D1 keyboard trap detector hit", async () => {
    const b01Path = path.resolve(__dirname, "../../../fixtures/pages/B01-keyboard-trap.html");
    const b01Html = fs.readFileSync(b01Path, "utf-8");

    const session = await loadSource({
      source: b01Html,
      kind: "html",
      navigationTimeoutMs: 5000,
    });

    try {
      const crawlResult = await crawl(session.page, { maxStops: 40, pauseMs: 30 });
      const hits = runDetectors({
        stateLabel: "S0",
        focusStops: crawlResult.forwardStops,
        interactions: [],
        candidateInteractives: ["#subscribe-btn"],
      });

      const d1Hit = hits.find((h) => h.detectorId === "D1");
      expect(d1Hit).toBeDefined();
      expect(d1Hit?.wcagId).toBe("2.1.2");
      expect(d1Hit?.severity).toBe("blocker");
    } finally {
      await session.close();
    }
  }, 20000);
});
