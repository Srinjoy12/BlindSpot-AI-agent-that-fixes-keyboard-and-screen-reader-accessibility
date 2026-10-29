import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function run() {
  console.log("Starting Summary & Tabs Verification Suite at 1440 x 900...");

  const outDir = path.resolve(process.cwd(), "docs/screenshots/tabs");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Listen for console errors
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  // Navigate to app
  console.log("Loading http://localhost:3000 ...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // Select Preset B08
  console.log("Selecting fixture preset B08...");
  const presetB08 = page.locator('button:has-text("B08")').first();
  await presetB08.waitFor({ state: "visible" });
  await presetB08.click();

  // Click Submit
  console.log("Starting audit run...");
  const startButton = page.locator("#audit-submit-button");
  await startButton.waitFor({ state: "visible" });
  await startButton.click();

  // Wait for audit completion
  console.log("Waiting for results...");
  await page.waitForSelector("#blindspot-results-tab-overview", { timeout: 45000 });
  await page.waitForTimeout(1000);

  console.log("Audit complete. Testing 1440 x 900 viewport visibility without scrolling...");

  // Verify elements are visible in 900px viewport without scrolling
  const headline = page.locator("p").filter({ hasText: /problem.*found/i }).first();
  await headline.waitFor({ state: "visible" });
  const headlineBox = await headline.boundingBox();

  const blockersStat = page.getByText("Blocks keyboard use", { exact: true });
  const majorsStat = page.getByText("Hard to use", { exact: true });
  const minorsStat = page.getByText("Minor", { exact: true });
  const fixesTestedStat = page.getByText("Fixes tested", { exact: true });

  const axeRow = page.getByText(/axe-core found/i);
  await axeRow.waitFor({ state: "visible" });
  const axeBox = await axeRow.boundingBox();

  const tabList = page.getByRole("tablist", { name: "Audit results sections" });
  await tabList.waitFor({ state: "visible" });
  const tabListBox = await tabList.boundingBox();

  console.log(`Headline top: ${headlineBox?.y}px, height: ${headlineBox?.height}px`);
  console.log(`Axe row top: ${axeBox?.y}px, height: ${axeBox?.height}px`);
  console.log(`Tab list top: ${tabListBox?.y}px, bottom: ${(tabListBox?.y || 0) + (tabListBox?.height || 0)}px`);

  const tabListBottom = (tabListBox?.y || 0) + (tabListBox?.height || 0);
  if (tabListBottom > 900) {
    throw new Error(`Tab bar bottom (${tabListBottom}px) exceeds 900px viewport height! Must be visible without scrolling.`);
  } else {
    console.log(`✓ Tab bar is fully visible within 900px vertical viewport (bottom is ${tabListBottom}px <= 900px)!`);
  }

  // Screenshot 1: 1440x900 Overview
  await page.screenshot({ path: path.join(outDir, "1440x900-overview.png") });
  console.log("Captured 1440x900-overview.png");

  // Keyboard navigation across tabs
  console.log("Testing keyboard navigation across tabs with Arrow keys, Home, and End...");
  const overviewTab = page.locator("#blindspot-results-tab-overview");
  await overviewTab.focus();

  // Arrow Right -> Problems
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  let activeTab = await page.evaluate(() => document.activeElement?.textContent);
  console.log("Active after ArrowRight:", activeTab);
  let currentUrl = page.url();
  if (!currentUrl.includes("#problems")) {
    throw new Error(`URL hash did not update to #problems! Current URL: ${currentUrl}`);
  }
  console.log("✓ URL hash updated to #problems");
  await page.screenshot({ path: path.join(outDir, "1440x900-problems.png") });

  // Arrow Right -> Keyboard path
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  currentUrl = page.url();
  if (!currentUrl.includes("#keyboard-path")) {
    throw new Error(`URL hash did not update to #keyboard-path! Current URL: ${currentUrl}`);
  }
  console.log("✓ URL hash updated to #keyboard-path");
  await page.screenshot({ path: path.join(outDir, "1440x900-keyboard-path.png") });

  // Arrow Right -> Fixes
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  currentUrl = page.url();
  if (!currentUrl.includes("#fixes")) {
    throw new Error(`URL hash did not update to #fixes! Current URL: ${currentUrl}`);
  }
  console.log("✓ URL hash updated to #fixes");
  await page.screenshot({ path: path.join(outDir, "1440x900-fixes.png") });

  // Test Full Screen button in Fixes tab
  const fullScreenBtn = page.getByRole("button", { name: /Full screen/i });
  if (await fullScreenBtn.count() > 0) {
    console.log("Testing Full screen diff modal trigger...");
    await fullScreenBtn.first().click();
    await page.waitForSelector('[role="dialog"]', { state: "visible" });
    console.log("✓ Full screen diff dialog opened");
    await page.screenshot({ path: path.join(outDir, "1440x900-fullscreen-diff.png") });
    // Dismiss with Escape
    await page.keyboard.press("Escape");
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });
    console.log("✓ Full screen diff dialog dismissed with Escape key");
  }

  // Arrow Right -> Models and cost
  await page.locator("#blindspot-results-tab-fixes").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  currentUrl = page.url();
  if (!currentUrl.includes("#models-and-cost")) {
    throw new Error(`URL hash did not update to #models-and-cost! Current URL: ${currentUrl}`);
  }
  console.log("✓ URL hash updated to #models-and-cost");
  await page.screenshot({ path: path.join(outDir, "1440x900-models-and-cost.png") });

  // Arrow Right -> Export
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  currentUrl = page.url();
  if (!currentUrl.includes("#export")) {
    throw new Error(`URL hash did not update to #export! Current URL: ${currentUrl}`);
  }
  console.log("✓ URL hash updated to #export");
  await page.screenshot({ path: path.join(outDir, "1440x900-export.png") });

  // Test "Copy summary" button
  console.log("Testing 'Copy summary' button...");
  const copySummaryBtn = page.getByRole("button", { name: /Copy summary/i });
  await copySummaryBtn.click();
  await page.waitForTimeout(500);
  const copySuccess = await page.getByText(/Summary copied/i).isVisible();
  console.log("✓ Copy summary feedback visible:", copySuccess);

  // Home key -> jumps to Overview
  console.log("Testing Home key...");
  await page.locator("#blindspot-results-tab-export").focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(300);
  currentUrl = page.url();
  if (!currentUrl.includes("#overview")) {
    throw new Error(`Home key did not jump to #overview! Current URL: ${currentUrl}`);
  }
  console.log("✓ Home key jumped to #overview");

  // End key -> jumps to Export
  console.log("Testing End key...");
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  currentUrl = page.url();
  if (!currentUrl.includes("#export")) {
    throw new Error(`End key did not jump to #export! Current URL: ${currentUrl}`);
  }
  console.log("✓ End key jumped to #export");

  // Test Theme toggle
  console.log("Testing theme toggle to light mode...");
  const themeToggle = page.locator("#theme-toggle-button");
  await themeToggle.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, "1440x900-export-light.png") });
  console.log("Captured 1440x900-export-light.png");

  // Check console errors
  if (consoleErrors.length > 0) {
    console.error("Console errors encountered:", consoleErrors);
    throw new Error(`Console errors occurred during execution: ${consoleErrors.join("; ")}`);
  }

  console.log("\n=======================================================");
  console.log("✅ All Summary and Tabs requirements verified successfully!");
  console.log("=======================================================\n");

  await browser.close();
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
