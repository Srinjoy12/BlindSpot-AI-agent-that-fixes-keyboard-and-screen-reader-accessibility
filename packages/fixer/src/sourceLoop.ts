// sourceLoop.ts — Multi-attempt revision loop & sequential multi-finding source fixer.
// Up to 3 attempts (initial + 2 revisions with feedback).
// Fixes one finding at a time on top of previous verified results, capped at 5 findings.

import { generateSourceFix, type FindingAnalysis, type SourceFixRequest, type SourceFixResponse } from "@blindspot/ai";
import type { DetectorHit } from "@blindspot/detectors";
import { computeUnifiedDiff } from "./diff.js";
import { lintDiff } from "./diffLinter.js";
import { verifySourceFix, type SourceVerificationResult } from "./sourceVerifier.js";

export interface SourceFixResult {
  findingId: string;
  detectorId: string;
  selector: string;
  status: "verified" | "unverified" | "rejected";
  diff: string;
  modifiedSource: string;
  attempts: number;
  beforeCrawlSummary: {
    stopsCount: number;
    hitsCount: number;
    blockersCount: number;
    majorsCount: number;
  };
  afterCrawlSummary: {
    stopsCount: number;
    hitsCount: number;
    blockersCount: number;
    majorsCount: number;
  };
  explanation?: string | undefined;
  verificationEvidence?: string | undefined;
  rejectionReason?: string | undefined;
}

export interface FixSourceOptions {
  source: string;
  findings: FindingAnalysis[] | any[];
  beforeHits?: DetectorHit[];
  beforeStopsCount?: number;
  maxFindings?: number; // defaults to 5
  maxAttemptsPerFinding?: number; // defaults to 3 (initial + 2 revisions)
  kind?: "html" | "snippet";
  fixGenerator?: (req: SourceFixRequest) => Promise<SourceFixResponse>;
}

export interface RunSourceFixLoopResult {
  fixes: SourceFixResult[];
  finalSource: string;
  allVerified: boolean;
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

/**
 * Executes the fix-and-verify loop for a single finding on the current source code.
 * Performs up to maxAttempts (3) with failure evidence fed back into Ultra.
 */
export async function fixSingleSourceFinding(
  currentSource: string,
  rawFinding: FindingAnalysis | any,
  options: {
    findingIndex?: number;
    beforeHits?: DetectorHit[];
    beforeStopsCount?: number;
    maxAttempts?: number;
    kind?: "html" | "snippet";
    fixGenerator?: (req: SourceFixRequest) => Promise<SourceFixResponse>;
  } = {}
): Promise<SourceFixResult> {
  const finding = normalizeFinding(rawFinding);
  const findingId = rawFinding?.id || `finding_${(options.findingIndex ?? 0) + 1}`;
  const beforeHits = options.beforeHits ?? [];
  const maxAttempts = options.maxAttempts ?? 2;
  const kind = options.kind ?? "html";
  const generator = options.fixGenerator ?? generateSourceFix;

  const beforeCrawlSummary = {
    stopsCount: options.beforeStopsCount ?? 0,
    hitsCount: beforeHits.length,
    blockersCount: beforeHits.filter((h) => h.severity === "blocker").length,
    majorsCount: beforeHits.filter((h) => h.severity === "major").length,
  };

  let lastAttemptDiff = "";
  let lastModifiedSource = currentSource;
  let lastExplanation = "";
  let previousAttemptFeedback: { modifiedSource: string; verificationError: string } | undefined;
  let status: "verified" | "unverified" | "rejected" = "unverified";
  let lastRejectionReason: string | undefined;
  let lastVerificationEvidence: string | undefined;
  let finalAfterCrawlSummary = { ...beforeCrawlSummary };
  let attemptsRun = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attemptsRun = attempt;

    // 1. Generate modified source from Ultra (or custom generator)
    let fixResponse: SourceFixResponse;
    try {
      fixResponse = await generator({
        source: currentSource,
        finding,
        attempt,
        findingId,
        ...(previousAttemptFeedback ? { previousAttempt: previousAttemptFeedback } : {}),
      });
    } catch (genErr) {
      status = "unverified";
      lastVerificationEvidence = `Fix generator error: ${genErr instanceof Error ? genErr.message : String(genErr)}`;
      break;
    }

    lastModifiedSource = fixResponse.modifiedSource;
    lastExplanation = fixResponse.explanation;

    // 2. Compute unified diff
    const diff = computeUnifiedDiff(currentSource, fixResponse.modifiedSource);
    lastAttemptDiff = diff;

    // If no changes were made to source, report unverified and feed back
    if (!diff || diff.trim() === "") {
      status = "unverified";
      lastVerificationEvidence = "Verification failed: the proposed fix did not make any changes to the source code.";
      previousAttemptFeedback = {
        modifiedSource: fixResponse.modifiedSource,
        verificationError: "The proposed fix did not modify the source code. Please make the necessary edits to remove the barrier.",
      };
      continue;
    }

    // 3. Security & Scope Linting on diff
    const lintResult = lintDiff(diff, currentSource);
    if (!lintResult.valid) {
      status = "rejected";
      lastRejectionReason = lintResult.reason;
      lastVerificationEvidence = `Diff rejected: ${lintResult.reason}`;
      previousAttemptFeedback = {
        modifiedSource: fixResponse.modifiedSource,
        verificationError: `Your previous diff was rejected: ${lintResult.reason}. Do not use forbidden APIs and keep changes minimal.`,
      };
      continue;
    }

    // 4. Airgapped Browser Verification
    let verification: SourceVerificationResult;
    try {
      verification = await verifySourceFix(fixResponse.modifiedSource, finding, beforeHits, kind);
    } catch (verErr) {
      status = "unverified";
      lastVerificationEvidence = `Verification crashed: ${verErr instanceof Error ? verErr.message : String(verErr)}`;
      previousAttemptFeedback = {
        modifiedSource: fixResponse.modifiedSource,
        verificationError: `Verification error: ${verErr instanceof Error ? verErr.message : String(verErr)}`,
      };
      continue;
    }

    finalAfterCrawlSummary = verification.afterCrawlSummary;
    lastVerificationEvidence = verification.evidence;

    if (verification.verified) {
      status = "verified";
      return {
        findingId,
        detectorId: finding.detectorId,
        selector: finding.selector,
        status: "verified",
        diff,
        modifiedSource: fixResponse.modifiedSource,
        attempts: attempt,
        beforeCrawlSummary,
        afterCrawlSummary: finalAfterCrawlSummary,
        explanation: lastExplanation,
        verificationEvidence: lastVerificationEvidence,
      };
    }

    // If not verified, set feedback for next attempt
    status = "unverified";
    previousAttemptFeedback = {
      modifiedSource: fixResponse.modifiedSource,
      verificationError: verification.evidence,
    };
  }

  // All attempts exhausted
  return {
    findingId,
    detectorId: finding.detectorId,
    selector: finding.selector,
    status,
    diff: lastAttemptDiff,
    modifiedSource: lastModifiedSource,
    attempts: attemptsRun,
    beforeCrawlSummary,
    afterCrawlSummary: finalAfterCrawlSummary,
    explanation: lastExplanation,
    verificationEvidence: lastVerificationEvidence,
    rejectionReason: lastRejectionReason,
  };
}

/**
 * Runs the sequential multi-finding source fixer on pasted code.
 * Fixes up to 5 findings sequentially, applying each verified fix on top of the previous.
 */
export async function runSourceFixLoop(options: FixSourceOptions): Promise<RunSourceFixLoopResult> {
  const maxFindings = Math.min(options.findings.length, options.maxFindings ?? 5);
  const targetFindings = options.findings.slice(0, maxFindings);

  const results: SourceFixResult[] = [];
  let activeSource = options.source;
  let currentBeforeHits = options.beforeHits ?? [];

  for (let idx = 0; idx < targetFindings.length; idx++) {
    const finding = targetFindings[idx]!;

    const fixResult = await fixSingleSourceFinding(activeSource, finding, {
      findingIndex: idx,
      beforeHits: currentBeforeHits,
      maxAttempts: options.maxAttemptsPerFinding ?? 3,
      kind: options.kind ?? "html",
      ...(options.beforeStopsCount !== undefined ? { beforeStopsCount: options.beforeStopsCount } : {}),
      ...(options.fixGenerator ? { fixGenerator: options.fixGenerator } : {}),
    });

    results.push(fixResult);

    // If verified, build subsequent fixes on top of this verified source
    if (fixResult.status === "verified") {
      activeSource = fixResult.modifiedSource;
    }
  }

  const allVerified = results.length > 0 && results.every((r) => r.status === "verified");

  return {
    fixes: results,
    finalSource: activeSource,
    allVerified,
  };
}
