// runner.ts — Runs benchmark evaluation on a fixture page against its ground truth manifest.

import { chromium, type Browser } from "playwright";
import fs from "fs";
import path from "path";
import { crawl, runInteractionPass } from "@blindspot/engine";
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
      document
        .querySelectorAll(
          "button, a[href], input, select, textarea, [role='button'], [role='tab'], [tabindex], [onclick]"
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

      return { selectors, hoverTriggers };
    })()`)) as { selectors: string[]; hoverTriggers: string[] };

    // Step 2.5: Run interaction pass to test popups, modals, and triggers
    const interactionResult = await runInteractionPass(page, { count: 1 });

    // Step 3: Run detectors
    const hits = runDetectors({
      stateLabel: "S0",
      focusStops: crawlResult.forwardStops,
      interactions: interactionResult.interactions,
      candidateInteractives: candidateData.selectors,
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
    let truePositives = 0;
    const matchedGroundTruth = new Set<number>();

    for (const hit of hits) {
      for (let idx = 0; idx < manifest.barriers.length; idx++) {
        if (matchedGroundTruth.has(idx)) continue;
        const gt = manifest.barriers[idx]!;

        if (hit.detectorId !== gt.detectorId) continue;

        let selectorMatch =
          hit.selector === gt.selector ||
          hit.selector.includes(gt.selector.replace(/^[#.]/, "")) ||
          gt.selector.includes(hit.selector.replace(/^[#.]/, ""));

        if (!selectorMatch) {
          selectorMatch = await page.evaluate(
            ({ selA, selB }) => {
              try {
                const elA = document.querySelector(selA);
                const elB = document.querySelector(selB);
                return !!(elA && elB && (elA.contains(elB) || elB.contains(elA)));
              } catch {
                return false;
              }
            },
            { selA: gt.selector, selB: hit.selector }
          );
        }

        if (selectorMatch) {
          truePositives++;
          matchedGroundTruth.add(idx);
          break;
        }
      }
    }

    const falsePositives = Math.max(0, hits.length - truePositives);
    const falseNegatives = manifest.barriers.length - truePositives;

    const precision = hits.length > 0 ? truePositives / hits.length : manifest.barriers.length === 0 ? 1 : 0;
    const recall = manifest.barriers.length > 0 ? truePositives / manifest.barriers.length : 1;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

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
    };
  } finally {
    await browser.close();
  }
}
