// axe.ts — Runs axe-core baseline audit on a Playwright page.
// Injects axe.min.js and extracts violation summaries without full HTML snippets.

import fs from "node:fs";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import type { AxeBaselineResult, AxeRuleSummary } from "./types.js";

const require = createRequire(import.meta.url);
let cachedAxeSource: string | null = null;

function getAxeSource(): string {
  if (cachedAxeSource) return cachedAxeSource;
  const axePath = require.resolve("axe-core/axe.min.js");
  cachedAxeSource = fs.readFileSync(axePath, "utf-8");
  return cachedAxeSource;
}

/**
 * Executes axe-core in the page context and returns condensed baseline metrics.
 */
export async function runAxe(page: Page): Promise<AxeBaselineResult> {
  const axeSource = getAxeSource();

  await page.evaluate((source) => {
    if (!(window as any).axe) {
      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    }
  }, axeSource);

  const rawResults = await page.evaluate(async () => {
    const axe = (window as any).axe;
    if (!axe) throw new Error("axe-core failed to load in page context");
    return await axe.run();
  });

  const version = rawResults?.testEngine?.version || "4.10.0";
  const violations = Array.isArray(rawResults?.violations) ? rawResults.violations : [];

  const rules: AxeRuleSummary[] = violations.map((v: any) => {
    const rawTags = Array.isArray(v.tags) ? v.tags : [];
    const wcagTags = rawTags.filter(
      (t: string) => t.startsWith("wcag") || t.startsWith("cat.")
    );

    const selectors: string[] = (v.nodes || [])
      .slice(0, 5)
      .map((node: any) => {
        if (Array.isArray(node.target)) {
          return node.target.flat().join(" ");
        }
        return String(node.target || "");
      })
      .filter((sel: string) => sel.length > 0);

    return {
      ruleId: String(v.id || "unknown"),
      description: String(v.description || v.help || v.id),
      impact: v.impact ? String(v.impact) : null,
      tags: wcagTags.length > 0 ? wcagTags : rawTags,
      nodeCount: (v.nodes || []).length,
      selectors,
    };
  });

  return {
    tool: "axe-core",
    version,
    violationCount: rules.length,
    rules,
  };
}

/**
 * Checks if a BlindSpot finding was also identified by axe-core.
 * Returns true only when:
 * 1. The selector matches an axe violation node.
 * 2. If a detector ID or WCAG ID is specified, the axe rule must actually detect that class of defect.
 *    (e.g., axe-core cannot detect runtime keyboard traps D1/2.1.2, dialog focus mismanagement D8/2.4.3,
 *    or sticky header focus obscuration D5/2.4.11; an unrelated aria-dialog-name or color-contrast hit
 *    on the same container is NOT a detection of the dynamic keyboard barrier).
 */
export function isFindingReportedByAxe(
  findingSelector: string,
  baseline?: AxeBaselineResult | null,
  wcagOrDetectorId?: string
): boolean {
  if (!baseline || !baseline.rules || baseline.rules.length === 0 || !findingSelector) {
    return false;
  }

  const target = findingSelector.trim().toLowerCase();

  for (const rule of baseline.rules) {
    if (wcagOrDetectorId) {
      const id = wcagOrDetectorId.toUpperCase();
      // axe-core has NO rules that detect runtime keyboard traps (D1 / 2.1.2)
      if (id === "D1" || id === "2.1.2") {
        continue;
      }
      // axe-core has NO rules that detect runtime dialog focus or roving tabindex (D8 / 2.4.3)
      if (id === "D8" || (id === "2.4.3" && !rule.ruleId.includes("tabindex"))) {
        continue;
      }
      // axe-core has NO rules that detect sticky header obscuration (D5 / 2.4.11)
      if (id === "D5" || id === "2.4.11") {
        continue;
      }
      // axe-core has NO rules that detect dynamic :focus outline suppression (D3 / 2.4.7)
      if (id === "D3" || id === "2.4.7") {
        continue;
      }
      // axe-core has NO rules that detect custom click divs lacking keyboard listeners (D2 / 2.1.1)
      if (id === "D2" || id === "2.1.1") {
        continue;
      }
      // D6 / 4.1.2 (Missing Accessible Name) matches only axe name/label rules
      if (id === "D6" || id === "4.1.2") {
        const isNameRule =
          rule.ruleId.includes("name") ||
          rule.ruleId.includes("label") ||
          rule.ruleId.includes("alt") ||
          rule.ruleId.includes("title");
        if (!isNameRule) continue;
      }
      // D7 / 2.4.3 (Positive Tabindex) matches axe's tabindex rule
      if (id === "D7") {
        if (!rule.ruleId.includes("tabindex")) continue;
      }
    }

    for (const sel of rule.selectors) {
      const clean = sel.trim().toLowerCase();
      if (clean === target) {
        return true;
      }
      // If one is an ID selector (e.g., "#subscribe-btn") and matches
      if (target.startsWith("#") && (clean.endsWith(target) || clean.includes(target))) {
        return true;
      }
      if (clean.startsWith("#") && (target.endsWith(clean) || target.includes(clean))) {
        return true;
      }
    }
  }

  return false;
}

const AXE_WCAG_MAP: Record<string, { wcagId: string; wcagName: string; severity: "blocker" | "major" | "minor" }> = {
  "color-contrast": { wcagId: "1.4.3", wcagName: "Contrast (Minimum)", severity: "major" },
  "heading-order": { wcagId: "1.3.1", wcagName: "Info and Relationships", severity: "minor" },
  "label-content-name-mismatch": { wcagId: "2.5.3", wcagName: "Label in Name", severity: "major" },
  "link-in-text-block": { wcagId: "1.4.1", wcagName: "Use of Color", severity: "minor" },
  "region": { wcagId: "1.3.1", wcagName: "Info and Relationships", severity: "minor" },
  "landmark-one-main": { wcagId: "1.3.1", wcagName: "Info and Relationships", severity: "major" },
  "page-has-heading-one": { wcagId: "1.3.1", wcagName: "Info and Relationships", severity: "minor" },
  "image-alt": { wcagId: "1.1.1", wcagName: "Non-text Content", severity: "major" },
  "button-name": { wcagId: "4.1.2", wcagName: "Name, Role, Value", severity: "major" },
  "link-name": { wcagId: "2.4.4", wcagName: "Link Purpose (In Context)", severity: "major" },
  "document-title": { wcagId: "2.4.2", wcagName: "Page Titled", severity: "minor" },
  "html-has-lang": { wcagId: "3.1.1", wcagName: "Language of Page", severity: "minor" },
  "bypass": { wcagId: "2.4.1", wcagName: "Bypass Blocks", severity: "minor" },
};

/**
 * Converts axe-core baseline rule violations into detector hit format
 * so that static WCAG issues are surfaced alongside runtime keyboard barriers.
 */
export function convertAxeRulesToHits(baseline?: AxeBaselineResult | null, existingHits: any[] = []): any[] {
  if (!baseline || !baseline.rules) return [];

  const newHits: any[] = [];
  for (const rule of baseline.rules) {
    const info = AXE_WCAG_MAP[rule.ruleId] || {
      wcagId: "WCAG 2.2",
      wcagName: "Accessibility Standard",
      severity: rule.impact === "critical" ? "blocker" : rule.impact === "serious" ? "major" : "minor",
    };

    const primarySelector = (rule.selectors && rule.selectors[0]) || "body";
    // Check if any selector from this rule is already covered by existingHits
    const alreadyCovered = existingHits.some(
      (h) =>
        h.selector === primarySelector ||
        (rule.selectors && rule.selectors.some((s: string) => h.selector === s))
    );
    if (alreadyCovered) continue;

    const selectorsList = rule.selectors?.slice(0, 3).join(", ") || primarySelector;
    const moreNotice = (rule.nodeCount || 0) > 3 ? ` (+${rule.nodeCount - 3} more)` : "";

    newHits.push({
      detectorId: `AXE-${rule.ruleId}`,
      selector: primarySelector,
      stateLabel: "S0",
      stopIndexes: [],
      evidence: `${rule.description || `Rule '${rule.ruleId}' violation`}. Affects: ${selectorsList}${moreNotice}.`,
      confidence: 1,
      severity: info.severity,
      wcagId: info.wcagId,
      alsoReportedByAxe: true,
    });
  }
  return newHits;
}

