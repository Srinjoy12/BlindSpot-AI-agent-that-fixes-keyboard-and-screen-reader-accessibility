// loop.ts — Fix-and-verify loop.
// Up to 3 attempts with failure evidence fed back into Ultra.
// Combines Nemotron Ultra (fix proposal) with deterministic code (browser verification).

import type { Page } from "playwright";
import { generateFix, type FindingAnalysis, type FixProposal } from "@blindspot/ai";
import { verifyFix, type VerificationResult } from "./verifier.js";

export interface FixLoopOptions {
  page: Page;
  finding: FindingAnalysis | any;
  elementHtmlSnippet?: string;
  domSnippet?: string;
  maxAttempts?: number;
  crawlOpts?: { maxStops?: number; pauseMs?: number };
}

export interface FixLoopResult {
  finding: FindingAnalysis;
  success: boolean;
  verified: boolean; // alias for success
  attempts: number;
  finalPatch?: FixProposal | undefined;
  winningFix?: FixProposal | undefined; // alias for finalPatch
  verification?: VerificationResult | undefined;
  history: Array<{
    attempt: number;
    patch: FixProposal;
    verified: boolean;
    evidence: string;
  }>;
}

function normalizeFinding(f: any): FindingAnalysis {
  if (f && f.wcag && f.detectorId && f.selector) {
    return f as FindingAnalysis;
  }
  const wcagId = f?.wcagId || f?.wcag?.id || "2.1.1";
  return {
    detectorId: (f?.detectorId || "D1") as any,
    severity: (f?.severity || "major") as any,
    wcag: {
      id: wcagId,
      name: f?.wcagName || f?.wcag?.name || `WCAG ${wcagId}`,
      level: (f?.wcag?.level as any) || "A",
      referenceUrl: f?.wcagUrl || f?.wcag?.referenceUrl || `https://www.w3.org/WAI/WCAG22/quickref/#${wcagId}`,
    },
    selector: f?.selector || "body",
    stateLabel: f?.stateLabel || "S0",
    impact: f?.impact || f?.userImpact || f?.evidence || "Barrier prevents keyboard navigation.",
    confidence: typeof f?.confidence === "number" ? f.confidence : 1,
  };
}

export async function runFixLoop(
  pageOrOptions: Page | FixLoopOptions,
  findingArg?: FindingAnalysis | any,
  elementHtmlSnippetArg?: string,
  maxAttemptsArg = 3
): Promise<FixLoopResult> {
  let page: Page;
  let rawFinding: any;
  let snippet: string | undefined;
  let maxAttempts = maxAttemptsArg;

  if ("page" in pageOrOptions && ("finding" in pageOrOptions || "domSnippet" in pageOrOptions)) {
    const opts = pageOrOptions as FixLoopOptions;
    page = opts.page;
    rawFinding = opts.finding;
    snippet = opts.elementHtmlSnippet || opts.domSnippet;
    if (typeof opts.maxAttempts === "number") maxAttempts = opts.maxAttempts;
  } else {
    page = pageOrOptions as Page;
    rawFinding = findingArg;
    snippet = elementHtmlSnippetArg;
  }

  const finding = normalizeFinding(rawFinding);
  const history: FixLoopResult["history"] = [];
  let previousAttempt: { patch: FixProposal; verificationError: string } | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // 1. Ultra generates fix proposal
    const patch = await generateFix({
      finding,
      attempt,
      findingId: (rawFinding as any)?.id || finding.detectorId,
      ...(snippet ? { elementHtmlSnippet: snippet } : {}),
      ...(previousAttempt ? { previousAttempt } : {}),
    });

    // 2. Deterministic browser verification
    const verification = await verifyFix(page, finding, patch);

    history.push({
      attempt,
      patch,
      verified: verification.verified,
      evidence: verification.evidence,
    });

    if (verification.verified) {
      return {
        finding,
        success: true,
        verified: true,
        attempts: attempt,
        finalPatch: patch,
        winningFix: patch,
        verification,
        history,
      };
    }

    // Set failure feedback for next attempt
    previousAttempt = {
      patch,
      verificationError: verification.evidence,
    };
  }

  const lastPatch = history[history.length - 1]?.patch;
  return {
    finding,
    success: false,
    verified: false,
    attempts: maxAttempts,
    finalPatch: lastPatch,
    winningFix: undefined,
    verification: undefined,
    history,
  };
}
