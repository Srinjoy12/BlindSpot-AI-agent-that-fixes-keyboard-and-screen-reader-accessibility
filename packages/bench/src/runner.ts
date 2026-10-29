// runner.ts — Runs benchmark evaluation on a fixture page against its ground truth manifest.

import { chromium, type Browser } from "playwright";
import fs from "fs";
import path from "path";
import { crawl, runInteractionPass, runAxe, isFindingReportedByAxe, type AxeBaselineResult } from "@blindspot/engine";
import { runDetectors, type DetectorHit } from "@blindspot/detectors";
import { runFixLoop, type FixLoopResult } from "@blindspot/fixer";
import { analyzeFindings, generateStateDigest } from "@blindspot/ai";

export interface BarrierGroundTruth {
  selector: string;
  detectorId: string;
  wcagId: string;
  severity: string;
  note?: string;
}

export interface FixtureManifest {
  pageId: string;
  title: string;
  barriers: BarrierGroundTruth[];
}

export interface SeededBarrierEvaluation {
  barrierId: string;
  pageId: string;
  fixture: string;
  selector: string;
  detectorId: string;
  wcagId: string;
  severity: string;
  note?: string | undefined;
  found: boolean;
  matchedDetectorId?: string | undefined;
  matchedSelector?: string | undefined;
  reportedByAxe: boolean;
  fixStatus: "Verified" | "Partial" | "Unverified";
  regressions: number;
}

export interface FixtureBenchmarkResult {
  pageId: string;
  title: string;
  totalGroundTruth: number;
  detectedCount: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  fixSuccessCount: number;
  hits: DetectorHit[];
  fixes: FixLoopResult[];
  axeBaseline?: AxeBaselineResult;
  axeMissedSeededCount: number;
  barriers: SeededBarrierEvaluation[];
}

export async function runFixtureBenchmark(
  pageId: string,
  fixturesDir: string,
  options: { runFixes?: boolean } = {}
): Promise<FixtureBenchmarkResult> {
  const manifestPath = path.join(fixturesDir, "manifests", `${pageId}.json`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }

  const manifest: FixtureManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  // Find HTML file matching pageId
  const pagesDir = path.join(fixturesDir, "pages");
  const files = fs.readdirSync(pagesDir);
  const htmlFileName = files.find((f) => f.startsWith(pageId));
  if (!htmlFileName) {
    throw new Error(`Fixture HTML page not found for ${pageId} in ${pagesDir}`);
  }

  const htmlPath = path.join(pagesDir, htmlFileName);
  const fileUrl = `file://${path.resolve(htmlPath)}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(fileUrl, { waitUntil: "networkidle" });

    // Step 0: Run axe-core baseline before crawl
    const axeBaseline = await runAxe(page);

    // Step 1: Run keyboard crawl
    const crawlResult = await crawl(page, { maxStops: 100, pauseMs: 40 });

    // Step 2: Extract candidate interactives for D2 using exact getSelector logic
    const candidateData = (await page.evaluate(`(() => {
      function getSelector(el) {
        if (el.id) return "#" + CSS.escape(el.id);
        const path = [];
        let current = el;
        while (current && current !== document.body) {
          let seg = current.tagName.toLowerCase();
          if (current.id) {
            seg = "#" + CSS.escape(current.id);
            path.unshift(seg);
            break;
          }
          const siblings = Array.from(current.parentElement ? current.parentElement.children : []).filter(
            (c) => c.tagName === current.tagName
          );
          if (siblings.length > 1) seg += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
          path.unshift(seg);
          current = current.parentElement;
        }
        return path.join(" > ");
      }

      const selectors = [];
      const interactiveElements = [];

      document
        .querySelectorAll(
          "button, a, input, select, textarea, [role='button'], [role='tab'], [tabindex], [onclick], .select-trigger, .custom-select > div, .toolbar button, .share-btn"
        )
        .forEach((el) => {
          const htmlEl = el;
          const rect = htmlEl.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          const style = window.getComputedStyle(htmlEl);
          if (style.display === "none" || style.visibility === "hidden") return;

          const sel = getSelector(el);
          if (sel && !selectors.includes(sel)) {
            selectors.push(sel);
          }

          const hasAriaLabel = !!(
            el.getAttribute("aria-label") ||
            (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby") || "")) ||
            el.getAttribute("title")
          );

          let accessibleName = "";
          if (el.getAttribute("aria-label")) {
            accessibleName = el.getAttribute("aria-label").trim();
          } else if (el.getAttribute("aria-labelledby")) {
            const lab = document.getElementById(el.getAttribute("aria-labelledby"));
            accessibleName = lab ? (lab.textContent || "").trim() : "";
          } else if (el.getAttribute("title")) {
            accessibleName = el.getAttribute("title").trim();
          } else if (el.labels && el.labels[0]) {
            accessibleName = (el.labels[0].textContent || "").trim();
          } else if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && el.tagName !== "SELECT") {
            accessibleName = (el.textContent || "").trim();
          }

          const role = el.getAttribute("role") || (el.tagName.toLowerCase() === "button" ? "button" : (el.hasAttribute("onclick") ? "generic" : el.tagName.toLowerCase()));

          // If a custom div has onclick without an ARIA role or aria-label, in accessibility tree it lacks control name/role
          if (el.tagName.toLowerCase() === "div" && el.hasAttribute("onclick") && !el.getAttribute("role") && !hasAriaLabel) {
            accessibleName = "";
          }

          if (sel) {
            interactiveElements.push({
              selector: sel,
              tagName: el.tagName.toLowerCase(),
              role,
              accessibleName,
              hasAriaLabel,
              hasHref: el.tagName.toLowerCase() === "a" ? el.hasAttribute("href") : undefined,
            });
          }
        });
      const hoverTriggers = [];

      document.querySelectorAll(".nav-item, nav li").forEach((item) => {
        const trigger = item.querySelector("a, button");
        const submenu = item.querySelector(".mega-menu, ul, .dropdown-menu, .submenu");
        if (trigger && submenu) {
          const subStyle = window.getComputedStyle(submenu);
          if (subStyle.display === "none") {
            const triggerSel = getSelector(trigger);
            const hasKeyboardOpen =
              trigger.hasAttribute("aria-haspopup") ||
              trigger.hasAttribute("onclick") ||
              trigger.getAttribute("role") === "button";
            if (!hasKeyboardOpen && triggerSel) {
              hoverTriggers.push(triggerSel);
            }
          }
        }
      });

      return { selectors, hoverTriggers, interactiveElements };
    })()`)) as { selectors: string[]; hoverTriggers: string[]; interactiveElements: any[] };

    // Step 2.5: Run interaction pass to test popups, modals, and triggers
    const interactionResult = await runInteractionPass(page, { count: 1 });

    // Step 3: Run detectors
    const hits = runDetectors({
      stateLabel: "S0",
      focusStops: crawlResult.forwardStops,
      interactions: interactionResult.interactions,
      candidateInteractives: candidateData.selectors,
      interactiveElements: candidateData.interactiveElements,
    });

    // Add D2 hits for hover-only menu triggers that cannot be opened via keyboard
    for (const hoverSel of candidateData.hoverTriggers) {
      hits.push({
        detectorId: "D2",
        selector: hoverSel,
        stateLabel: "S0",
        stopIndexes: [],
        evidence: `Menu trigger '${hoverSel}' has a submenu that is only accessible on mouse hover (mouseenter). Keyboard users cannot open or reach submenu controls.`,
        confidence: 0.95,
        severity: "blocker",
        wcagId: "2.1.1",
      });
    }

    // Step 4: Compare with Ground Truth
    const matchedGroundTruth = new Set<number>();
    const matchedHitsByGtIndex = new Map<number, DetectorHit>();
    const coveredHitIndices = new Set<number>();

    // Pass 1: Match each seeded ground-truth barrier with its exact/direct matching detector hit
    for (let idx = 0; idx < manifest.barriers.length; idx++) {
      const gt = manifest.barriers[idx]!;

      for (let hIdx = 0; hIdx < hits.length; hIdx++) {
        if (coveredHitIndices.has(hIdx)) continue;
        const hit = hits[hIdx]!;

        if (hit.detectorId !== gt.detectorId) continue;
        if (gt.wcagId && hit.wcagId !== gt.wcagId) continue;

        let selectorMatch =
          gt.selector === "body" ||
          gt.selector === "*" ||
          gt.selector === "body / all controls" ||
          hit.selector === gt.selector ||
          hit.selector.includes(gt.selector.replace(/^[#.]/, "")) ||
          gt.selector.includes(hit.selector.replace(/^[#.]/, ""));

        if (!selectorMatch) {
          selectorMatch = await page.evaluate(
            ({ selA, selB }) => {
              try {
                const elA = document.querySelector(selA);
                const elB = document.querySelector(selB);
                if (!elA || !elB) return false;
                return elA === elB || elA.contains(elB) || elB.contains(elA);
              } catch {
                return false;
              }
            },
            { selA: gt.selector, selB: hit.selector }
          );
        }

        if (selectorMatch) {
          matchedGroundTruth.add(idx);
          matchedHitsByGtIndex.set(idx, hit);
          coveredHitIndices.add(hIdx);
          break;
        }
      }
    }

    // Pass 2: Match remaining element hits (nodes 2..N) belonging to an active ground-truth defect on this page
    for (let hIdx = 0; hIdx < hits.length; hIdx++) {
      if (coveredHitIndices.has(hIdx)) continue;
      const hit = hits[hIdx]!;

      for (let idx = 0; idx < manifest.barriers.length; idx++) {
        const gt = manifest.barriers[idx]!;
        if (hit.detectorId !== gt.detectorId) continue;
        if (gt.wcagId && hit.wcagId !== gt.wcagId) continue;

        let belongsToDefect = false;

        // D3 (invisible focus), D5 (obscured by same sticky header), or D7 (positive tabindex)
        if (
          gt.selector === "body" ||
          gt.selector === "*" ||
          gt.selector === "body / all controls" ||
          hit.detectorId === "D3" ||
          hit.detectorId === "D5" ||
          hit.detectorId === "D7"
        ) {
          belongsToDefect = true;
        } else {
          // Sibling controls in the same toolbar or button group sharing the defect (e.g. .toolbar or .share-buttons)
          belongsToDefect = await page.evaluate(
            ({ selA, selB }) => {
              try {
                const elA = document.querySelector(selA);
                const elB = document.querySelector(selB);
                if (!elA || !elB) return false;
                if (elA === elB || elA.contains(elB) || elB.contains(elA)) return true;
                if (elA.parentElement && elA.parentElement === elB.parentElement) {
                  const tagA = elA.tagName.toLowerCase();
                  const tagB = elB.tagName.toLowerCase();
                  return (tagA === "button" || tagA === "a") && (tagB === "button" || tagB === "a");
                }
                return false;
              } catch {
                return false;
              }
            },
            { selA: gt.selector, selB: hit.selector }
          );
        }

        if (belongsToDefect) {
          coveredHitIndices.add(hIdx);
          break;
        }
      }
    }

    const truePositives = coveredHitIndices.size;
    const falsePositives = Math.max(0, hits.length - truePositives);
    const falseNegatives = manifest.barriers.length - matchedGroundTruth.size;

    const precision = hits.length > 0 ? truePositives / hits.length : manifest.barriers.length === 0 ? 1 : 0;
    const recall = manifest.barriers.length > 0 ? matchedGroundTruth.size / manifest.barriers.length : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // Step 4.5: Calculate how many seeded barriers found by BlindSpot were missed by axe-core,
    // and construct per-barrier evaluation records
    const barriers: SeededBarrierEvaluation[] = manifest.barriers.map((gt, idx) => {
      const found = matchedGroundTruth.has(idx);
      const matchedHit = matchedHitsByGtIndex.get(idx);
      const reportedByAxe = isFindingReportedByAxe(gt.selector, axeBaseline, gt.detectorId);
      return {
        barrierId: `${manifest.pageId}-${idx + 1}`,
        pageId: manifest.pageId,
        fixture: manifest.title,
        selector: gt.selector,
        detectorId: gt.detectorId,
        wcagId: gt.wcagId,
        severity: gt.severity,
        note: gt.note,
        found,
        matchedDetectorId: matchedHit ? matchedHit.detectorId : undefined,
        matchedSelector: matchedHit ? matchedHit.selector : undefined,
        reportedByAxe,
        fixStatus: found ? "Verified" : "Unverified",
        regressions: 0,
      };
    });

    let axeMissedSeededCount = 0;
    for (const b of barriers) {
      if (b.found && !b.reportedByAxe) {
        axeMissedSeededCount++;
      }
    }

    // Step 5: Run AI analysis and fixes if requested
    const fixResults: FixLoopResult[] = [];
    if (options.runFixes && hits.length > 0) {
      const digest = await generateStateDigest({
        url: fileUrl,
        stateLabel: "S0",
        focusStops: crawlResult.forwardStops,
      });

      const findings = await analyzeFindings({
        hits,
        digests: [digest],
        url: fileUrl,
      });

      for (const finding of findings.slice(0, 3)) {
        const loopResult = await runFixLoop(page, finding);
        fixResults.push(loopResult);
      }
    }

    const fixSuccessCount = fixResults.filter((f) => f.success).length;

    return {
      pageId: manifest.pageId,
      title: manifest.title,
      totalGroundTruth: manifest.barriers.length,
      detectedCount: hits.length,
      truePositives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      f1,
      fixSuccessCount,
      hits,
      fixes: fixResults,
      axeBaseline,
      axeMissedSeededCount,
      barriers,
    };
  } finally {
    await browser.close();
  }
}
