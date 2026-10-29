// fileSetLoop.ts — Multi-attempt revision loop & sequential multi-finding fixer for FileSet projects.
// Identifies candidate files with localizer, asks Nemotron Ultra for source edits,
// computes diffs, lints added lines, and verifies via airgapped browser crawl on the modified FileSet.

import {
  generateSourceFix,
  type FindingAnalysis,
  type SourceFixRequest,
  type SourceFixResponse,
} from "@blindspot/ai";
import type { DetectorHit } from "@blindspot/detectors";
import type { FileSet } from "@blindspot/engine";
import { computeUnifiedDiff } from "./diff.js";
import { lintDiff } from "./diffLinter.js";
import { localizeCandidateFiles } from "./localizer.js";
import { verifyFileSetFix } from "./fileSetVerifier.js";
import type { SourceVerificationResult } from "./sourceVerifier.js";

export interface FileSetEdit {
  path: string;
  original: string;
  modified: string;
  unifiedDiff: string;
  findingIds: string[];
  status: "verified" | "unverified" | "rejected";
  attempts: number;
  explanation?: string | undefined;
  verificationEvidence?: string | undefined;
  rejectionReason?: string | undefined;
  beforeCrawlSummary?:
    | {
        stopsCount: number;
        hitsCount: number;
        blockersCount: number;
        majorsCount: number;
      }
    | undefined;
  afterCrawlSummary?:
    | {
        stopsCount: number;
        hitsCount: number;
        blockersCount: number;
        majorsCount: number;
      }
    | undefined;
}

export interface RunFileSetFixLoopOptions {
  fileSet: FileSet;
  entryPath?: string;
  findings: FindingAnalysis[] | any[];
  beforeHits?: DetectorHit[];
  beforeStopsCount?: number;
  maxFindings?: number; // default: 5
  maxAttemptsPerFinding?: number; // default: 3
  fixGenerator?: (req: SourceFixRequest) => Promise<SourceFixResponse>;
}

export interface RunFileSetFixLoopResult {
  edits: FileSetEdit[];
  finalFileSet: FileSet;
  allVerified: boolean;
  findings: FindingAnalysis[];
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
 * Executes the sequential fix-and-verify loop across files in a project folder.
 * Fixes up to maxFindings barriers one at a time on top of previous verified results.
 */
export async function runFileSetFixLoop(
  options: RunFileSetFixLoopOptions
): Promise<RunFileSetFixLoopResult> {
  const originalFileSet = options.fileSet;
  const currentFileSet: FileSet = new Map(originalFileSet);
  const entryPath = options.entryPath || "index.html";
  const rawFindings = options.findings || [];
  const maxFindings = Math.min(options.maxFindings ?? 5, rawFindings.length);
  const maxAttempts = options.maxAttemptsPerFinding ?? 3;
  const generator = options.fixGenerator ?? generateSourceFix;
  const beforeHits = options.beforeHits ?? [];

  const edits: FileSetEdit[] = [];
  const normalizedFindings: FindingAnalysis[] = [];

  const beforeCrawlSummary = {
    stopsCount: options.beforeStopsCount ?? 0,
    hitsCount: beforeHits.length,
    blockersCount: beforeHits.filter((h) => h.severity === "blocker").length,
    majorsCount: beforeHits.filter((h) => h.severity === "major").length,
  };

  for (let i = 0; i < maxFindings; i++) {
    const rawFinding = rawFindings[i];
    const finding = normalizeFinding(rawFinding);
    normalizedFindings.push(finding);

    const findingId = rawFinding?.id || `finding_${i + 1}`;

    // 1. Localize candidate files for this finding
    const candidates = localizeCandidateFiles(
      {
        selector: finding.selector,
        detectorId: finding.detectorId,
        evidence: rawFinding?.evidence || finding.impact,
        impact: finding.impact,
      },
      currentFileSet,
      { maxCandidates: 3, maxTotalBytes: 60 * 1024 }
    );

    if (candidates.length === 0) {
      // No suitable candidate file found
      edits.push({
        path: entryPath,
        original: currentFileSet.get(entryPath) || "",
        modified: currentFileSet.get(entryPath) || "",
        unifiedDiff: "",
        findingIds: [findingId],
        status: "unverified",
        attempts: 0,
        rejectionReason: `Could not localize responsible source file for selector '${finding.selector}'.`,
        verificationEvidence: "Localization could not identify matching files in project.",
        beforeCrawlSummary,
      });
      continue;
    }

    const primaryCandidate = candidates[0]!;
    const candidatePath = primaryCandidate.path;

    // Strict validation: candidatePath MUST be in originalFileSet
    if (!originalFileSet.has(candidatePath)) {
      edits.push({
        path: candidatePath,
        original: "",
        modified: "",
        unifiedDiff: "",
        findingIds: [findingId],
        status: "rejected",
        attempts: 0,
        rejectionReason: `Target path '${candidatePath}' is not an uploaded file.`,
        beforeCrawlSummary,
      });
      continue;
    }

    const currentCandidateContent = currentFileSet.get(candidatePath) || "";
    const originalCandidateContent = originalFileSet.get(candidatePath) || currentCandidateContent;

    let bestResult: FileSetEdit | null = null;
    let previousFailure: { modifiedSource: string; verificationError: string } | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let fixResponse: SourceFixResponse;
      try {
        fixResponse = await generator({
          source: currentCandidateContent,
          finding,
          attempt,
          findingId,
          stage: `fix-attempt-${attempt}` as any,
          ...(previousFailure ? { previousAttempt: previousFailure } : {}),
        });
      } catch (err: any) {
        if (attempt === maxAttempts && !bestResult) {
          bestResult = {
            path: candidatePath,
            original: originalCandidateContent,
            modified: currentCandidateContent,
            unifiedDiff: "",
            findingIds: [findingId],
            status: "rejected",
            attempts: attempt,
            rejectionReason: `Fix generation failed: ${err.message}`,
            beforeCrawlSummary,
          };
        }
        continue;
      }

      // Check if modifiedSource differs from current content
      if (fixResponse.modifiedSource === currentCandidateContent) {
        previousFailure = {
          modifiedSource: fixResponse.modifiedSource,
          verificationError: "Model proposed an identical source file with no modifications.",
        };
        if (attempt === maxAttempts && !bestResult) {
          bestResult = {
            path: candidatePath,
            original: originalCandidateContent,
            modified: currentCandidateContent,
            unifiedDiff: "",
            findingIds: [findingId],
            status: "unverified",
            attempts: attempt,
            explanation: fixResponse.explanation,
            rejectionReason: "Model proposed no code changes.",
            verificationEvidence: "Proposed source was identical to original.",
            beforeCrawlSummary,
          };
        }
        continue;
      }

      // Compute unified diff
      const diff = computeUnifiedDiff(
        currentCandidateContent,
        fixResponse.modifiedSource,
        candidatePath
      );

      // Security and scope lint on ADDED lines
      const lint = lintDiff(diff, currentCandidateContent);
      if (!lint.valid) {
        previousFailure = {
          modifiedSource: fixResponse.modifiedSource,
          verificationError: `Lint rejection: ${lint.reason || "Patch violates security policy or size limits."}`,
        };
        bestResult = {
          path: candidatePath,
          original: originalCandidateContent,
          modified: fixResponse.modifiedSource,
          unifiedDiff: diff,
          findingIds: [findingId],
          status: "rejected",
          attempts: attempt,
          explanation: fixResponse.explanation,
          rejectionReason: lint.reason,
          verificationEvidence: `Rejected by security linter: ${lint.reason}`,
          beforeCrawlSummary,
        };
        continue;
      }

      // Create trial FileSet
      const trialFileSet: FileSet = new Map(currentFileSet);
      trialFileSet.set(candidatePath, fixResponse.modifiedSource);

      // Verify trial FileSet in airgapped browser
      let verification: SourceVerificationResult;
      try {
        verification = await verifyFileSetFix(
          trialFileSet,
          entryPath,
          finding,
          beforeHits
        );
      } catch (verr: any) {
        verification = {
          verified: false,
          targetBarrierEliminated: false,
          regressionsIntroduced: false,
          newRegressions: [],
          remainingHits: [],
          evidence: `Airgapped verification failed with runtime error: ${verr.message}`,
          afterCrawlSummary: { stopsCount: 0, hitsCount: 0, blockersCount: 0, majorsCount: 0 },
        };
      }

      if (verification.verified) {
        // Fix verified! Apply to currentFileSet for subsequent findings
        currentFileSet.set(candidatePath, fixResponse.modifiedSource);

        bestResult = {
          path: candidatePath,
          original: originalCandidateContent,
          modified: fixResponse.modifiedSource,
          unifiedDiff: diff,
          findingIds: [findingId],
          status: "verified",
          attempts: attempt,
          explanation: fixResponse.explanation,
          verificationEvidence: verification.evidence,
          beforeCrawlSummary,
          afterCrawlSummary: verification.afterCrawlSummary,
        };
        break; // Finding resolved, exit attempt loop
      } else {
        // Verification failed
        previousFailure = {
          modifiedSource: fixResponse.modifiedSource,
          verificationError: verification.evidence,
        };

        bestResult = {
          path: candidatePath,
          original: originalCandidateContent,
          modified: fixResponse.modifiedSource,
          unifiedDiff: diff,
          findingIds: [findingId],
          status: "unverified",
          attempts: attempt,
          explanation: fixResponse.explanation,
          verificationEvidence: verification.evidence,
          beforeCrawlSummary,
          afterCrawlSummary: verification.afterCrawlSummary,
        };
      }
    }

    if (bestResult) {
      edits.push(bestResult);
    }
  }

  const allVerified = edits.length > 0 && edits.every((e) => e.status === "verified");

  return {
    edits,
    finalFileSet: currentFileSet,
    allVerified,
    findings: normalizedFindings,
  };
}
