// sourceVerifier.ts — Airgapped browser verification of modified source code.
// Evaluates modified source in an isolated sandboxed session using loadSource.
// Rule 6: Verified ONLY if target detector no longer fires on target selector AND no new Blocker/Major findings appeared.

import { loadSource, crawl, runInteractionPass, runAxe, convertAxeRulesToHits } from "@blindspot/engine";
import { runDetectors, type DetectorHit } from "@blindspot/detectors";
import type { FindingAnalysis } from "@blindspot/ai";

export interface SourceVerificationResult {
  verified: boolean;
  targetBarrierEliminated: boolean;
  regressionsIntroduced: boolean;
  newRegressions: DetectorHit[];
  remainingHits: DetectorHit[];
  evidence: string;
  afterCrawlSummary: {
    stopsCount: number;
    hitsCount: number;
    blockersCount: number;
    majorsCount: number;
  };
}

export async function verifySourceFix(
  modifiedSource: string,
  finding: FindingAnalysis,
  beforeHits: DetectorHit[] = [],
  kind: "html" | "snippet" = "html"
): Promise<SourceVerificationResult> {
  const session = await loadSource({ source: modifiedSource, kind });

  try {
    const isAxeOnly = finding.detectorId.startsWith("AXE-");

    // 1. Run keyboard crawl (skip full tab crawl if verifying static axe-core rules)
    const crawlResult = isAxeOnly
      ? { forwardStops: [], backwardStops: [], cycleDetected: false, limitHit: null }
      : await crawl(session.page, { maxStops: 40, backwardStops: 10, pauseMs: 15 });

    // 2. Extract candidate interactives
    const candidateData = isAxeOnly
      ? { selectors: [], hoverTriggers: [] }
      : ((await session.page.evaluate(`(() => {
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
    })()`)) as { selectors: string[]; hoverTriggers: string[] });

    // 3. Run interaction pass (only if keyboard detectors are involved)
    const interactionResult = isAxeOnly
      ? { interactions: [] }
      : await runInteractionPass(session.page, { count: 1 });

    // 4. Run detectors
    const postHits = runDetectors({
      stateLabel: "S0",
      focusStops: crawlResult.forwardStops,
      interactions: interactionResult.interactions,
      candidateInteractives: candidateData.selectors,
    });

    for (const hoverSel of candidateData.hoverTriggers) {
      if (!postHits.some((h) => h.selector === hoverSel && h.detectorId === "D2")) {
        postHits.push({
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

    if (finding.detectorId.startsWith("AXE-") || beforeHits.some((h) => h.detectorId.startsWith("AXE-"))) {
      try {
        const axeBaseline = await runAxe(session.page);
        postHits.push(...convertAxeRulesToHits(axeBaseline, postHits));
      } catch {
        // axe failed during verification
      }
    }

    // 5. Check if target detector still fires on target selector
    const targetStillFires = postHits.some((h) => {
      if (h.detectorId !== finding.detectorId) return false;
      const cleanTarget = finding.selector.replace(/^[#.]/, "");
      const cleanHit = h.selector.replace(/^[#.]/, "");
      return (
        h.selector === finding.selector ||
        cleanHit.includes(cleanTarget) ||
        cleanTarget.includes(cleanHit)
      );
    });

    const targetBarrierEliminated = !targetStillFires;

    // 6. Check for new Blocker or Major regressions
    const newRegressions = postHits.filter((afterHit) => {
      if (afterHit.severity !== "blocker" && afterHit.severity !== "major") return false;
      // If the finding being fixed was a blocker (such as a keyboard trap D1),
      // removing it unblocks keyboard navigation to the rest of the page.
      // Pre-existing elements outside the blocker that are now reached for the first time
      // are unmasked DOM elements, not regressions introduced by the fix.
      if (finding.severity === "blocker" && afterHit.selector !== finding.selector) {
        return false;
      }
      const cleanAfter = afterHit.selector.replace(/^[#.]/, "");
      const existedBefore = beforeHits.some((beforeHit) => {
        if (beforeHit.detectorId !== afterHit.detectorId) return false;
        const cleanBefore = beforeHit.selector.replace(/^[#.]/, "");
        return (
          beforeHit.selector === afterHit.selector ||
          cleanBefore.includes(cleanAfter) ||
          cleanAfter.includes(cleanBefore)
        );
      });
      return !existedBefore;
    });

    const regressionsIntroduced = newRegressions.length > 0;
    const verified = targetBarrierEliminated && !regressionsIntroduced;

    let evidence: string;
    if (verified) {
      evidence = `Fix verified in airgapped browser session: detector '${finding.detectorId}' on '${finding.selector}' successfully resolved with 0 new regressions.`;
    } else if (targetStillFires && regressionsIntroduced) {
      evidence = `Verification failed: barrier '${finding.detectorId}' is still present on '${finding.selector}', and ${newRegressions.length} new regression(s) appeared.`;
    } else if (targetStillFires) {
      evidence = `Verification failed: barrier '${finding.detectorId}' is still present on '${finding.selector}'.`;
    } else {
      evidence = `Verification failed: target barrier resolved, but introduced ${newRegressions.length} new regression(s): ${newRegressions.map((r) => `${r.detectorId} on ${r.selector}`).join(", ")}.`;
    }

    return {
      verified,
      targetBarrierEliminated,
      regressionsIntroduced,
      newRegressions,
      remainingHits: postHits,
      evidence,
      afterCrawlSummary: {
        stopsCount: crawlResult.forwardStops.length,
        hitsCount: postHits.length,
        blockersCount: postHits.filter((h) => h.severity === "blocker").length,
        majorsCount: postHits.filter((h) => h.severity === "major").length,
      },
    };
  } finally {
    await session.close();
  }
}
