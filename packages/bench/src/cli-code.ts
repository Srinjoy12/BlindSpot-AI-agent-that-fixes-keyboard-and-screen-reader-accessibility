#!/usr/bin/env node
// cli-code.ts — BlindSpot Benchmark Suite: Code Mode Runner.
// Evaluates broken fixtures B01–B12, clean fixtures C01–C03, and prompt injection fixture H01
// through the paste-code pipeline with live Nemotron models (Nano, Super, Ultra).
// Saves results to artifacts/benchmark_code_mode.json.

import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  runFixtureCodeBenchmark,
  type FixtureCodeBenchmarkResult,
} from "./runner-code.js";
import { closeSharedBrowser } from "@blindspot/engine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesDir = path.resolve(__dirname, "../../../fixtures");

const CODE_FIXTURE_IDS = [
  "B01", "B02", "B03", "B04", "B05", "B06",
  "B07", "B08", "B09", "B10", "B11", "B12",
  "C01", "C02", "C03",
  "H01",
];

async function main() {
  const args = process.argv.slice(2);
  const targetId = args[0];

  const idsToRun =
    targetId && CODE_FIXTURE_IDS.includes(targetId)
      ? [targetId]
      : CODE_FIXTURE_IDS;

  console.log("=".repeat(84));
  console.log("BlindSpot — Code Mode (Paste Code Sandbox) Benchmark Suite");
  console.log("Live Models: Nemotron Nano (Digest), Nemotron Super (Analysis), Nemotron Ultra (Fix)");
  console.log("=".repeat(84));
  console.log(`Fixtures Directory: ${fixturesDir}`);
  console.log(`Evaluating ${idsToRun.length} fixture(s) in airgapped browser with live model verification...`);
  console.log("");

  const results: FixtureCodeBenchmarkResult[] = [];
  const failures: Array<{
    pageId: string;
    detectorId: string;
    selector: string;
    status: string;
    reason: string;
  }> = [];

  for (const pageId of idsToRun) {
    process.stdout.write(`Benchmarking ${pageId} in code mode... `);
    const startMs = Date.now();
    try {
      const res = await runFixtureCodeBenchmark(pageId, fixturesDir);
      results.push(res);
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

      // Track verification failures
      for (const fix of res.fixes) {
        if (fix.status !== "verified") {
          failures.push({
            pageId,
            detectorId: fix.detectorId,
            selector: fix.selector,
            status: fix.status,
            reason: fix.rejectionReason || fix.verificationEvidence || "Verification condition not met in airgap crawl.",
          });
        }
      }

      if (res.findingsDetected === 0) {
        console.log(`✅ CLEAN | 0 findings | ${elapsed}s`);
      } else {
        const verifiedPct =
          res.fixesAttempted > 0
            ? ((res.fixesVerified / res.fixesAttempted) * 100).toFixed(0)
            : "0";
        const statusBadge =
          res.fixesVerified === res.fixesAttempted && res.fixesAttempted > 0
            ? "✅ ALL VERIFIED"
            : res.fixesVerified > 0
            ? "🟡 PARTIAL VERIFIED"
            : "❌ UNVERIFIED";

        console.log(
          `${statusBadge} | Det: ${res.findingsDetected} | Fixes: ${res.fixesVerified}/${res.fixesAttempted} (${verifiedPct}%) | Att: ${res.attemptsUsed} | Lat: ${(res.latencyMs / 1000).toFixed(1)}s | Cost: $${res.estimatedCostUsd.toFixed(4)} | ${elapsed}s`
        );
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Summary Metrics
  const brokenResults = results.filter((r) => r.pageId.startsWith("B"));
  const cleanResults = results.filter((r) => r.pageId.startsWith("C"));
  const hostileResults = results.filter((r) => r.pageId.startsWith("H"));

  const totalFindings = brokenResults.reduce((sum, r) => sum + r.findingsDetected, 0);
  const totalFixesAttempted = brokenResults.reduce((sum, r) => sum + r.fixesAttempted, 0);
  const totalFixesVerified = brokenResults.reduce((sum, r) => sum + r.fixesVerified, 0);
  const totalFixesUnverified = brokenResults.reduce((sum, r) => sum + r.fixesUnverified, 0);
  const totalFixesRejected = brokenResults.reduce((sum, r) => sum + r.fixesRejected, 0);
  const totalAttempts = brokenResults.reduce((sum, r) => sum + r.attemptsUsed, 0);

  const totalTokensIn = results.reduce((sum, r) => sum + r.tokensIn, 0);
  const totalTokensOut = results.reduce((sum, r) => sum + r.tokensOut, 0);
  const totalCostUsd = results.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
  const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);

  const verifiedDiffRate =
    totalFixesAttempted > 0 ? (totalFixesVerified / totalFixesAttempted) * 100 : 0;
  const meanAttemptsPerFix =
    totalFixesAttempted > 0 ? totalAttempts / totalFixesAttempted : 0;
  const meanCostPerFix =
    totalFixesAttempted > 0 ? totalCostUsd / totalFixesAttempted : 0;
  const cleanFalseAlarms = cleanResults.reduce((sum, r) => sum + r.findingsDetected, 0);
  const injectionPassed = hostileResults.every((r) => r.injectionPassed !== false);

  console.log("\n" + "=".repeat(84));
  console.log("Code Mode Benchmark Summary Scorecard");
  console.log("=".repeat(84));
  console.log(`Verified-Diff Rate:            ${verifiedDiffRate.toFixed(1)}% (${totalFixesVerified}/${totalFixesAttempted} attempted fixes verified in browser)`);
  console.log(`Mean Attempts per Fix:         ${meanAttemptsPerFix.toFixed(2)} attempts`);
  console.log(`Mean Cost per Fix:             $${meanCostPerFix.toFixed(4)} USD`);
  console.log(`Total Model Compute Cost:      $${totalCostUsd.toFixed(4)} USD (${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out)`);
  console.log(`Fixes Status Breakdown:        ${totalFixesVerified} Verified · ${totalFixesUnverified} Unverified · ${totalFixesRejected} Rejected`);
  console.log(`Clean Pages False Alarms (C01–C03): ${cleanFalseAlarms} findings (${cleanResults.length} pages verified)`);
  console.log(`Prompt Injection Defense (H01):      ${injectionPassed ? "PASSED (Safe — no instruction following, airgap intact)" : "FAILED"}`);
  console.log("=".repeat(84));

  if (failures.length > 0) {
    console.log("\nVerification Failures & Non-Verified Fixes:");
    for (const f of failures) {
      console.log(`  - [${f.pageId}] ${f.detectorId} on '${f.selector}': ${f.status.toUpperCase()} — ${f.reason}`);
    }
  }

  // Save artifact JSON
  const outDir = path.resolve(__dirname, "../../../artifacts");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "benchmark_code_mode.json");
  const artifactPayload = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFixtures: results.length,
      brokenFixturesEvaluated: brokenResults.length,
      cleanFixturesEvaluated: cleanResults.length,
      hostileFixturesEvaluated: hostileResults.length,
      totalFindingsDetected: totalFindings,
      totalFixesAttempted,
      totalFixesVerified,
      totalFixesUnverified,
      totalFixesRejected,
      verifiedDiffRate: parseFloat(verifiedDiffRate.toFixed(1)),
      meanAttemptsPerFix: parseFloat(meanAttemptsPerFix.toFixed(2)),
      meanCostPerFixUsd: parseFloat(meanCostPerFix.toFixed(4)),
      totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
      totalTokensIn,
      totalTokensOut,
      totalLatencyMs,
      cleanFalseAlarms,
      promptInjectionPassed: injectionPassed,
    },
    fixtures: results,
    verificationFailures: failures,
  };

  fs.writeFileSync(outPath, JSON.stringify(artifactPayload, null, 2), "utf-8");
  console.log(`\nArtifact saved: ${outPath}`);

  await closeSharedBrowser();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
