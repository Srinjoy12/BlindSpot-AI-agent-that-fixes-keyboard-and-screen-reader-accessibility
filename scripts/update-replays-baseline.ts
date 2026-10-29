#!/usr/bin/env tsx
// scripts/update-replays-baseline.ts
// Injects real axe-core baseline and alsoReportedByAxe into data/replays/*.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { runAxe, isFindingReportedByAxe } from "../packages/engine/src/axe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const FIXTURES_DIR = path.resolve(REPO_ROOT, "fixtures/pages");
const REPLAYS_DIR = path.resolve(REPO_ROOT, "data/replays");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const replayFiles = fs.readdirSync(REPLAYS_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Updating axe baseline for ${replayFiles.length} replay files...`);

  for (const file of replayFiles) {
    const pageId = file.replace(/\.json$/, "");
    const replayPath = path.join(REPLAYS_DIR, file);
    const replay = JSON.parse(fs.readFileSync(replayPath, "utf-8"));

    const htmlFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.startsWith(pageId));
    if (htmlFiles.length === 0) {
      console.warn(`No fixture found for ${pageId}`);
      continue;
    }
    const htmlPath = path.join(FIXTURES_DIR, htmlFiles[0]!);
    const fileUrl = `file://${path.resolve(htmlPath)}`;

    await page.goto(fileUrl, { waitUntil: "networkidle" });
    const baseline = await runAxe(page);

    if (replay.report) {
      replay.report.baseline = baseline;
      if (Array.isArray(replay.report.barriers)) {
        for (const barrier of replay.report.barriers) {
          barrier.alsoReportedByAxe = isFindingReportedByAxe(barrier.selector, baseline);
        }
      }
    }

    fs.writeFileSync(replayPath, JSON.stringify(replay, null, 2), "utf-8");
    console.log(`Updated ${pageId}: ${baseline.violationCount} axe violations`);
  }

  await browser.close();
  console.log("All replays successfully updated with real axe baseline!");
}

main().catch((err) => {
  console.error("Error updating replays:", err);
  process.exit(1);
});
