// axe.test.ts — Unit and integration tests for axe-core baseline and matching.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { runAxe, isFindingReportedByAxe, type AxeBaselineResult } from "../src/index.js";

describe("axe-core matching logic", () => {
  const sampleBaseline: AxeBaselineResult = {
    tool: "axe-core",
    version: "4.10.0",
    violationCount: 2,
    rules: [
      {
        ruleId: "button-name",
        impact: "critical",
        tags: ["wcag2a", "wcag412"],
        nodeCount: 1,
        selectors: ["#subscribe-btn", "nav > button.close"],
      },
      {
        ruleId: "color-contrast",
        impact: "serious",
        tags: ["wcag2aa", "wcag143"],
        nodeCount: 1,
        selectors: [".footer-link"],
      },
    ],
  };

  it("returns true for exact selector match", () => {
    expect(isFindingReportedByAxe("#subscribe-btn", sampleBaseline)).toBe(true);
    expect(isFindingReportedByAxe("nav > button.close", sampleBaseline)).toBe(true);
    expect(isFindingReportedByAxe(".footer-link", sampleBaseline)).toBe(true);
  });

  it("returns true for ID-based matching", () => {
    expect(isFindingReportedByAxe("button#subscribe-btn", sampleBaseline)).toBe(true);
  });

  it("returns false for non-matching selector", () => {
    expect(isFindingReportedByAxe("#unrelated-element", sampleBaseline)).toBe(false);
    expect(isFindingReportedByAxe("div.main-content", sampleBaseline)).toBe(false);
  });

  it("handles case where axe reports 0 violations gracefully", () => {
    const zeroViolationsBaseline: AxeBaselineResult = {
      tool: "axe-core",
      version: "4.10.0",
      violationCount: 0,
      rules: [],
    };

    expect(isFindingReportedByAxe("#any-element", zeroViolationsBaseline)).toBe(false);
  });

  it("handles null or undefined baseline safely", () => {
    expect(isFindingReportedByAxe("#any-element", undefined)).toBe(false);
    expect(isFindingReportedByAxe("#any-element", null)).toBe(false);
  });
});

describe("runAxe Playwright integration", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("runs axe-core on a page with violations and keeps at most 5 selectors without html snippets", async () => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Test Page</title></head>
      <body>
        <main>
          <button id="unnamed-btn"></button>
          <img id="unnamed-img" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
        </main>
      </body>
      </html>
    `);

    const baseline = await runAxe(page);

    expect(baseline.tool).toBe("axe-core");
    expect(baseline.version).toBeDefined();
    expect(baseline.violationCount).toBeGreaterThan(0);
    expect(baseline.rules.length).toBe(baseline.violationCount);

    for (const rule of baseline.rules) {
      expect(rule.ruleId).toBeDefined();
      expect(Array.isArray(rule.selectors)).toBe(true);
      expect(rule.selectors.length).toBeLessThanOrEqual(5);
      // Ensure no raw HTML snippets are present in the rule object
      expect((rule as any).html).toBeUndefined();
      expect((rule as any).nodes).toBeUndefined();
    }

    // Verify finding matcher against the real baseline
    expect(isFindingReportedByAxe("#unnamed-btn", baseline)).toBe(true);
    expect(isFindingReportedByAxe("#unnamed-img", baseline)).toBe(true);
    expect(isFindingReportedByAxe("#non-existent", baseline)).toBe(false);
  });

  it("runs axe-core on a clean accessible page and returns 0 violations", async () => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Accessible Clean Page</title></head>
      <body>
        <main>
          <h1>Clean Accessible Heading</h1>
          <button id="accessible-btn">Submit form</button>
        </main>
      </body>
      </html>
    `);

    const baseline = await runAxe(page);
    expect(baseline.tool).toBe("axe-core");
    expect(baseline.violationCount).toBe(0);
    expect(baseline.rules).toEqual([]);
    expect(isFindingReportedByAxe("#accessible-btn", baseline)).toBe(false);
  });
});
