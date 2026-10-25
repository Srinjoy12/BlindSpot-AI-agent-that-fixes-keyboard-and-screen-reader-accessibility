// verifier.ts — Deterministic browser verification of accessibility fixes.
// Proves each fix by re-running the same keyboard test in a real browser.
// Per AGENTS.md Rule 3: Verification is code-only; verdicts never depend on a model.

import type { Page } from "playwright";
import type { FindingAnalysis, FixProposal } from "@blindspot/ai";
import { crawl } from "@blindspot/engine";
import { runDetectors, type DetectorHit } from "@blindspot/detectors";
import { applyPatch } from "./apply.js";

export interface VerificationResult {
  verified: boolean;
  barrierEliminated: boolean;
  regressionsIntroduced: boolean;
  remainingHits: DetectorHit[];
  evidence: string;
}

export async function verifyFix(
  page: Page,
  finding: FindingAnalysis,
  patch: FixProposal
): Promise<VerificationResult> {
  // 1. Apply the patch
  const applyResult = await applyPatch(page, patch);
  if (!applyResult.applied) {
    return {
      verified: false,
      barrierEliminated: false,
      regressionsIntroduced: false,
      remainingHits: [],
      evidence: `Patch application failed: ${applyResult.error ?? "unknown error"}`,
    };
  }

  // Brief pause for DOM to stabilize
  await page.waitForTimeout(100);

  // 2. Re-run the keyboard crawl
  const crawlResult = await crawl(page, { maxStops: 60, pauseMs: 40 });

  // 3. Run detectors on the re-crawled state
  const postPatchHits = runDetectors({
    stateLabel: finding.stateLabel,
    focusStops: crawlResult.forwardStops,
    interactions: [],
    candidateInteractives: [finding.selector],
  });

  // 4. Check if the specific barrier is eliminated
  const stillHasTargetBarrier = postPatchHits.some(
    (hit: DetectorHit) => hit.detectorId === finding.detectorId && (hit.selector === finding.selector || hit.selector.includes(finding.selector.replace(/^[#.]/, "")))
  );

  const barrierEliminated = !stillHasTargetBarrier;

  // 5. Check if any new blocker regressions appeared
  const newBlockers = postPatchHits.filter((hit: DetectorHit) => hit.severity === "blocker");
  const regressionsIntroduced = newBlockers.length > 0 && finding.severity !== "blocker";

  const verified = barrierEliminated && !regressionsIntroduced;

  const evidence = verified
    ? `Fix verified in real browser. Keyboard crawl confirmed barrier '${finding.detectorId}' on '${finding.selector}' is resolved without regressions.`
    : `Verification failed: ${stillHasTargetBarrier ? `barrier '${finding.detectorId}' is still present on '${finding.selector}'.` : "regressions detected."}`;

  return {
    verified,
    barrierEliminated,
    regressionsIntroduced,
    remainingHits: postPatchHits,
    evidence,
  };
}
