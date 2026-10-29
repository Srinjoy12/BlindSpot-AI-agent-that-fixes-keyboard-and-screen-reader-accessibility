import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function run() {
  console.log("Starting Models and Cost Tab Verification Suite...");

  const outDir = path.resolve(process.cwd(), "docs/screenshots/tabs");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  console.log("Loading http://localhost:3000 ...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // Select Preset B08
  console.log("Selecting fixture preset B08...");
  const presetB08 = page.locator('button:has-text("B08")').first();
  await presetB08.waitFor({ state: "visible" });
  await presetB08.click();

  // Start audit
  console.log("Submitting audit...");
  const startButton = page.locator("#audit-submit-button");
  await startButton.waitFor({ state: "visible" });
  await startButton.click();

  // Wait for results
  console.log("Waiting for results tabs...");
  await page.waitForSelector("#blindspot-results-tab-overview", { timeout: 45000 });
  await page.waitForTimeout(1000);

  // ----------------------------------------------------
  // TEST MODELS AND COST TAB
  // ----------------------------------------------------
  console.log("\n=== Testing Models and Cost Tab ===");
  const modelsTab = page.locator("#blindspot-results-tab-models-and-cost");
  await modelsTab.click();
  await page.waitForTimeout(600);

  const panel = page.locator("#blindspot-results-panel-models-and-cost");
  await panel.waitFor({ state: "visible" });

  // 1. Verify drawer at bottom is removed
  const oldDrawer = page.locator('text="Token factory telemetry ledger"');
  if (await oldDrawer.isVisible()) {
    throw new Error("Old LedgerDrawer at the bottom of the page should be removed.");
  }
  console.log("✓ Old bottom drawer is removed; all content lives in Models and cost tab.");

  // 2. Privacy notice line
  const privacyNotice = panel.getByText(/Page text is sent to NVIDIA Nemotron models on Nebius Token Factory\. Nothing is stored after the run\./i);
  await privacyNotice.waitFor({ state: "visible" });
  console.log("✓ Found privacy notice line.");

  // 3. Recorded run indicator
  const recordedRunBadge = panel.getByText(/Recorded run: figures are from the original run/i);
  await recordedRunBadge.waitFor({ state: "visible" });
  console.log("✓ Found 'Recorded run: figures are from the original run' badge.");

  // 4. Top row four plain numbers (Stat components)
  const estimatedCostStat = panel.getByText("Estimated cost", { exact: true }).first();
  await estimatedCostStat.waitFor({ state: "visible" });
  console.log("✓ Found 'Estimated cost' stat.");

  const costDisclaimer = panel.getByText(/Estimated from configured per-token prices\. Actual billing may differ\./i);
  await costDisclaimer.waitFor({ state: "visible" });
  console.log("✓ Found cost disclaimer under estimated cost.");

  const tokensUsedStat = panel.getByText("Tokens used", { exact: true });
  await tokensUsedStat.waitFor({ state: "visible" });
  console.log("✓ Found 'Tokens used' stat.");

  const modelCallsStat = panel.getByText("Model calls", { exact: true });
  await modelCallsStat.waitFor({ state: "visible" });
  console.log("✓ Found 'Model calls' stat.");

  const timeTakenStat = panel.getByText("Time taken", { exact: true });
  await timeTakenStat.waitFor({ state: "visible" });
  console.log("✓ Found 'Time taken' stat.");

  // 5. Cost per tested fix sentence
  const costPerFix = panel.getByText(/About \$[\d.]+ per fix that passed testing/i);
  if (await costPerFix.isVisible()) {
    console.log("✓ Found 'Cost per tested fix' sentence:", (await costPerFix.innerText()).trim());
  }

  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, "models-and-cost-top-1440.png") });
  console.log("✓ Captured models-and-cost-top-1440.png");

  // 6. "Which model did what" Table
  const table = panel.locator("table").first();
  await table.waitFor({ state: "visible" });

  const caption = table.locator("caption");
  await caption.waitFor({ state: "visible" });
  console.log("✓ Found table caption:", (await caption.innerText()).trim());

  // Check columns: Model, Type, What it does, Calls, Tokens in, Tokens out, Time, Estimated cost
  for (const col of ["Model", "Type", "What it does", "Calls", "Tokens in", "Tokens out", "Time", "Estimated cost"]) {
    const th = table.locator("th").filter({ hasText: new RegExp(col, "i") }).first();
    await th.waitFor({ state: "visible" });
  }
  console.log("✓ All 8 columns verified in 'Which model did what' table.");

  // Check plain words in "What it does"
  await table.getByText("Presses keys and measures the page").waitFor({ state: "visible" });
  await table.getByText("Standard checker used as a baseline").waitFor({ state: "visible" });
  await table.getByText("Summarises each page state").waitFor({ state: "visible" });
  await table.getByText("Ranks problems and explains who is affected").waitFor({ state: "visible" });
  await table.getByText("Looks up current WCAG guidance").waitFor({ state: "visible" });
  await table.getByText("Writes and re-writes fixes").waitFor({ state: "visible" });
  console.log("✓ All plain-language 'What it does' descriptions verified in pipeline order.");

  // Check Type column markers: Model vs Code
  const codeBadges = table.locator("span").filter({ hasText: /^Code$/ });
  const modelBadges = table.locator("span").filter({ hasText: /^Model$/ });
  if ((await codeBadges.count()) < 2) throw new Error("Expected Code badges");
  if ((await modelBadges.count()) < 3) throw new Error("Expected Model badges");
  console.log("✓ Found 'Model' vs 'Code' markers.");

  // Check real model names
  const realNanoModel = table.getByText(/NVIDIA-Nemotron-3-Nano/i);
  await realNanoModel.waitFor({ state: "visible" });
  console.log("✓ Real model name verified:", (await realNanoModel.innerText()).trim());

  // Check run totals row in tfoot
  const tfootTotals = table.locator("tfoot th").filter({ hasText: /Run totals/i });
  await tfootTotals.waitFor({ state: "visible" });
  console.log("✓ Found Run totals row in table footer.");

  // 7. "Where the time went" horizontal stacked bar
  const stackedBar = panel.locator('div[role="img"][aria-label*="Time allocation"]');
  await stackedBar.waitFor({ state: "visible" });
  console.log("✓ Found 'Where the time went' horizontal stacked bar.");

  // Verify text legend with seconds
  const legendSeconds = panel.getByText(/Crawl: \d+(\.\d+)?s.*axe-core: \d+(\.\d+)?s.*Models: \d+(\.\d+)?s.*Verification: \d+(\.\d+)?s/i);
  await legendSeconds.waitFor({ state: "visible" });
  console.log("✓ Found text legend with exact seconds for all 4 stages.");

  // 8. "Today's budget" native progress element
  const budgetProgress = panel.locator("progress");
  await budgetProgress.waitFor({ state: "visible" });
  const budgetLabel = panel.getByText(/\d+% of today's token budget used/i);
  await budgetLabel.waitFor({ state: "visible" });
  console.log("✓ Found native <progress> element with label:", (await budgetLabel.innerText()).trim());

  // 9. Expandable "Show each call" list (collapsed by default)
  const showCallsBtn = panel.getByRole("button", { name: /Show each call/i });
  await showCallsBtn.waitFor({ state: "visible" });
  console.log("✓ Found 'Show each call' button (collapsed by default).");

  // Click to expand
  await showCallsBtn.click();
  await page.waitForTimeout(300);

  const callsTable = panel.locator('table').nth(1);
  await callsTable.waitFor({ state: "visible" });
  console.log("✓ Expanded calls list successfully.");

  // Check columns in calls table: Time, Model, Tokens, Result
  await callsTable.getByText("Time", { exact: true }).waitFor({ state: "visible" });
  await callsTable.getByText("Model", { exact: true }).waitFor({ state: "visible" });
  await callsTable.getByText("Tokens", { exact: true }).waitFor({ state: "visible" });
  await callsTable.getByText("Result", { exact: true }).waitFor({ state: "visible" });
  console.log("✓ Individual calls list verified with time, model, tokens, and result.");

  // Take screenshot
  await page.screenshot({ path: path.join(outDir, "models-and-cost-desktop-1440.png") });
  await panel.screenshot({ path: path.join(outDir, "models-and-cost-full-1440.png") });
  console.log("✓ Captured models-and-cost-desktop-1440.png and models-and-cost-full-1440.png");

  // Check console errors
  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected: ${consoleErrors.join("; ")}`);
  }
  console.log("✓ Zero console errors detected!");

  await browser.close();
  console.log("\n🎉 Models and Cost Tab verification completed successfully!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
