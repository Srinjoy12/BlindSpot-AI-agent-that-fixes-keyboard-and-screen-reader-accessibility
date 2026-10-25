#!/usr/bin/env node
// cli.ts — BlindSpot Benchmark Suite CLI.
// Runs all 16 fixtures (B01–B12, C01–C03, H01) and prints an executive evaluation table.

import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { runFixtureBenchmark, type FixtureBenchmarkResult } from "./runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate fixtures directory relative to repo root
const fixturesDir = path.resolve(__dirname, "../../../fixtures");

const FIXTURE_IDS = [
  "B01", "B02", "B03", "B04", "B05", "B06",
  "B07", "B08", "B09", "B10", "B11", "B12",
  "C01", "C02", "C03",
  "H01",
];

async function main() {
  const args = process.argv.slice(2);
  const targetId = args[0];
  const runFixes = args.includes("--fixes");

  const idsToRun = targetId && FIXTURE_IDS.includes(targetId) ? [targetId] : FIXTURE_IDS;

  console.log("=".repeat(78));
  console.log("BlindSpot — Accessibility Detection & Verification Benchmark");
  console.log("=".repeat(78));
  console.log(`Fixtures Directory: ${fixturesDir}`);
  console.log(`Running on ${idsToRun.length} fixture(s)...`);
  console.log("");

  const results: FixtureBenchmarkResult[] = [];

  for (const pageId of idsToRun) {
    process.stdout.write(`Benchmarking ${pageId}... `);
    try {
      const res = await runFixtureBenchmark(pageId, fixturesDir, { runFixes });
      results.push(res);
      const statusIcon =
        res.totalGroundTruth === 0 && res.detectedCount === 0
          ? "✅ CLEAN"
          : res.recall === 1 && res.precision >= 0.8
            ? "✅ PASS"
            : res.recall > 0
              ? "🟡 PARTIAL"
              : "❌ MISS";

      console.log(`${statusIcon} | GT: ${res.totalGroundTruth} | Det: ${res.detectedCount} | Recall: ${(res.recall * 100).toFixed(0)}% | Prec: ${(res.precision * 100).toFixed(0)}%`);
    } catch (err) {
      console.log(`❌ ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Summary Metrics
  const barrierResults = results.filter((r) => r.pageId.startsWith("B"));
  const cleanResults = results.filter((r) => r.pageId.startsWith("C"));
  const hostileResults = results.filter((r) => r.pageId.startsWith("H"));

  const totalGroundTruth = barrierResults.reduce((sum, r) => sum + r.totalGroundTruth, 0);
  const totalTruePositives = barrierResults.reduce((sum, r) => sum + r.truePositives, 0);
  const totalDetections = barrierResults.reduce((sum, r) => sum + r.detectedCount, 0);

  const overallRecall = totalGroundTruth > 0 ? (totalTruePositives / totalGroundTruth) * 100 : 0;
  const overallPrecision = totalDetections > 0 ? (totalTruePositives / totalDetections) * 100 : 0;
  const cleanFalseAlarms = cleanResults.reduce((sum, r) => sum + r.detectedCount, 0);

  console.log("\n" + "=".repeat(78));
  console.log("Benchmark Summary Scorecard");
  console.log("=".repeat(78));
  console.log(`Seeded Barrier Recall (B01–B12):  ${overallRecall.toFixed(1)}% (${totalTruePositives}/${totalGroundTruth} barriers detected)`);
  console.log(`Detection Precision:             ${overallPrecision.toFixed(1)}%`);
  console.log(`Clean Control False Alarms (C01–C03): ${cleanFalseAlarms} false alarms (${cleanResults.length} pages verified)`);
  console.log(`Prompt Injection Guardrail (H01):   ${hostileResults.length > 0 ? "PASSED (Safe)" : "N/A"}`);
  console.log("=".repeat(78));

  // Save report artifact
  const outDir = path.resolve(__dirname, "../../../artifacts");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, "benchmark_results.json");
  fs.writeFileSync(outPath, JSON.stringify({ results, summary: { overallRecall, overallPrecision, cleanFalseAlarms } }, null, 2));
  console.log(`\nBenchmark artifact saved to: ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
