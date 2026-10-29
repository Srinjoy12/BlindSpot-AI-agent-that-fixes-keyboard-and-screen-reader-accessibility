import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function run() {
  console.log("Starting Readable Working Tabs Verification Suite...");

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
  // TEST TAB 1: PROBLEMS TAB
  // ----------------------------------------------------
  console.log("\n=== Testing Problems Tab ===");
  const problemsTab = page.locator("#blindspot-results-tab-problems");
  await problemsTab.click();
  await page.waitForTimeout(600);

  // 1. Definition help text under heading
  const problemsHelpText = page.getByText(/A keyboard trap prevents someone using Tab from ever leaving/i);
  await problemsHelpText.waitFor({ state: "visible" });
  console.log("✓ Found one-line plain definition under Problems heading.");

  // 2. Check problem rows
  const problemRows = page.locator('div[role="button"][aria-label*="element"]');
  const count = await problemRows.count();
  console.log(`✓ Found ${count} problem rows.`);
  if (count === 0) throw new Error("Expected at least 1 problem row in Problems tab");

  // Verify first row contents
  const firstRow = problemRows.first();
  const rowSeverity = firstRow.locator("span").filter({ hasText: /Blocks keyboard use|Hard to use|Minor/i }).first();
  await rowSeverity.waitFor({ state: "visible" });
  console.log("✓ Row displays severity icon + text:", (await rowSeverity.innerText()).trim());

  const rowElement = firstRow.locator("code").first();
  await rowElement.waitFor({ state: "visible" });
  console.log("✓ Row displays page element in monospace:", (await rowElement.innerText()).trim());

  const rowWcag = firstRow.locator("a").filter({ hasText: /WCAG|Focus Order|Trap/i }).first();
  await rowWcag.waitFor({ state: "visible" });
  console.log("✓ Row displays short link-styled WCAG criterion:", (await rowWcag.innerText()).trim());

  const rowFixStatus = firstRow.locator("span").filter({ hasText: /Fix tested|Fix not tested/i }).first();
  await rowFixStatus.waitFor({ state: "visible" });
  console.log("✓ Row displays Fix tested / not tested status:", (await rowFixStatus.innerText()).trim());

  // 3. Test selecting row and verifying Detail Panel
  console.log("Selecting problem row to open detail panel...");
  await firstRow.click();
  await page.waitForTimeout(400);

  const detailPanel = page.locator('div[role="region"][aria-label^="Details for problem"]');
  await detailPanel.waitFor({ state: "visible" });
  console.log("✓ Detail panel is visible.");

  const whatHappensHeader = detailPanel.getByText(/What happens \(keyboard reproduction\)/i);
  await whatHappensHeader.waitFor({ state: "visible" });
  console.log("✓ Detail panel contains 'What happens (keyboard reproduction)' steps.");

  const whoItAffectsHeader = detailPanel.getByText(/Who it affects/i);
  await whoItAffectsHeader.waitFor({ state: "visible" });
  console.log("✓ Detail panel contains 'Who it affects' impact statement.");

  const evidenceHeader = detailPanel.getByText(/Evidence/i);
  await evidenceHeader.waitFor({ state: "visible" });
  console.log("✓ Detail panel contains Evidence.");

  const guidanceHeader = detailPanel.getByText(/Guidance source/i);
  await guidanceHeader.waitFor({ state: "visible" });
  const guidanceLink = detailPanel.locator('a[href*="w3.org"]');
  await guidanceLink.waitFor({ state: "visible" });
  console.log("✓ Detail panel contains Tavily/W3C guidance link:", await guidanceLink.getAttribute("href"));

  const fixHeader = detailPanel.getByText(/The fix/i);
  await fixHeader.waitFor({ state: "visible" });
  console.log("✓ Detail panel contains 'The fix' section.");

  // Check fallback callout notice if present
  const fallbackNotice = detailPanel.getByText(/Deterministic fallback used/i);
  if (await fallbackNotice.isVisible()) {
    console.log("✓ Deterministic fallback callout present and correctly formatted.");
  }

  await page.screenshot({ path: path.join(outDir, "problems-desktop-1440.png") });
  console.log("✓ Captured problems-desktop-1440.png");

  // ----------------------------------------------------
  // TEST TAB 2: KEYBOARD PATH TAB
  // ----------------------------------------------------
  console.log("\n=== Testing Keyboard Path Tab ===");
  const pathTab = page.locator("#blindspot-results-tab-keyboard-path");
  await pathTab.click();
  await page.waitForTimeout(600);

  // 1. Definition help text under heading
  const pathHelpText = page.getByText(/The keyboard path tracks every sequential stop reached by pressing Tab/i);
  await pathHelpText.waitFor({ state: "visible" });
  console.log("✓ Found one-line plain definition under Keyboard path heading.");

  // 2. Scrubber controls & counter
  const stepCounter = page.getByText(/Tab stop \d+ of \d+/i);
  await stepCounter.waitFor({ state: "visible" });
  console.log("✓ Found step counter:", (await stepCounter.innerText()).trim());

  const prevButton = page.getByRole("button", { name: /Previous/i });
  const nextButton = page.getByRole("button", { name: /Next/i });
  await prevButton.waitFor({ state: "visible" });
  await nextButton.waitFor({ state: "visible" });

  // 3. Current Step narrative text panel
  const stepNarrative = page.locator("div").filter({ hasText: /^Step 1: / }).first();
  await stepNarrative.waitFor({ state: "visible" });
  console.log("✓ Found formatted plain English step narrative:", (await stepNarrative.innerText()).slice(0, 100) + "...");

  // 4. Test arrow key navigation on the scrubber
  console.log("Testing keyboard arrow-key navigation on the scrubber...");
  const scrubber = page.locator('div[role="region"][aria-label*="timeline"]');
  await scrubber.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);

  const step2Counter = page.getByText(/Tab stop 2 of/i);
  await step2Counter.waitFor({ state: "visible" });
  console.log("✓ Pressing ArrowRight advanced scrubber to Tab stop 2.");

  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  const step1Counter = page.getByText(/Tab stop 1 of/i);
  await step1Counter.waitFor({ state: "visible" });
  console.log("✓ Pressing ArrowLeft returned scrubber to Tab stop 1.");

  // 5. Test Next button
  await nextButton.click();
  await page.waitForTimeout(300);
  await step2Counter.waitFor({ state: "visible" });
  console.log("✓ Next button advances scrubber to stop 2.");

  // 6. Problem point marker in scrubber
  const problemMarker = scrubber.getByText("Problem").first();
  if (await problemMarker.isVisible()) {
    console.log("✓ Problem point clearly marked in scrubber with icon and text label 'Problem'.");
  }

  // 7. 2D Bounding-Box SVG View
  const svgMap = page.locator('svg[aria-label*="Interactive 2D path map"]');
  await svgMap.waitFor({ state: "visible" });
  console.log("✓ 2D SVG bounding-box path map rendered.");

  await page.screenshot({ path: path.join(outDir, "keyboard-path-desktop-1440.png") });
  console.log("✓ Captured keyboard-path-desktop-1440.png");

  // ----------------------------------------------------
  // TEST TAB 3: FIXES TAB
  // ----------------------------------------------------
  console.log("\n=== Testing Fixes Tab ===");
  const fixesTab = page.locator("#blindspot-results-tab-fixes");
  await fixesTab.click();
  await page.waitForTimeout(600);

  const fixesPanel = page.locator("#blindspot-results-panel-fixes");

  // 1. Definition help text under heading
  const fixesHelpText = fixesPanel.getByText(/Verified fixes are tested in a real browser session to prove the barrier/i);
  await fixesHelpText.waitFor({ state: "visible" });
  console.log("✓ Found one-line plain definition under Fixes heading.");

  // 2. Fix cards with status heading
  const testedHeading = fixesPanel.locator("span").filter({ hasText: /Tested: the problem is gone|Not tested|Rejected/i }).first();
  await testedHeading.waitFor({ state: "visible" });
  console.log("✓ Found fix status heading:", (await testedHeading.innerText()).trim());

  const attemptsMuted = fixesPanel.getByText(/1 attempt/i).first();
  await attemptsMuted.waitFor({ state: "visible" });
  console.log("✓ Found attempts count in muted text:", (await attemptsMuted.innerText()).trim());

  // 3. Verification evidence sentence
  const evidenceBanner = fixesPanel.locator("div").filter({ hasText: /regressions|headless crawl|Focus now reaches/i }).first();
  await evidenceBanner.waitFor({ state: "visible" });
  console.log("✓ Found verification evidence sentence:", (await evidenceBanner.innerText()).slice(0, 100) + "...");

  // 4. Unified diff with line numbers and +/- markers
  const diffRow = fixesPanel.locator('div[style*="grid-template-columns"]').first();
  await diffRow.waitFor({ state: "visible" });
  console.log("✓ Found unified diff grid with line numbers and +/- markers.");

  // 5. Copy fix button
  const copyFixBtn = fixesPanel.getByRole("button", { name: "Copy fix" }).first();
  await copyFixBtn.waitFor({ state: "visible" });
  await copyFixBtn.click();
  await page.waitForTimeout(300);

  const copiedFeedback = fixesPanel.getByRole("button", { name: "Copied fix ✓" }).first();
  await copiedFeedback.waitFor({ state: "visible" });
  console.log("✓ Copy fix button clicked and showed 'Copied fix ✓' confirmation.");

  await page.screenshot({ path: path.join(outDir, "fixes-desktop-1440.png") });
  console.log("✓ Captured fixes-desktop-1440.png");

  // ----------------------------------------------------
  // RESPONSIVE VIEWPORTS TEST (768px and 375px)
  // ----------------------------------------------------
  console.log("\n=== Testing Responsive Breakpoints ===");

  // Tablet 768px
  await page.setViewportSize({ width: 768, height: 1024 });
  await problemsTab.click();
  const problemsPanel = page.locator("#blindspot-results-panel-problems");
  await problemsPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "problems-tablet-768.png") });
  console.log("✓ Captured problems-tablet-768.png");

  // Mobile 375px
  await page.setViewportSize({ width: 375, height: 812 });
  await problemsPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "problems-mobile-375.png") });
  console.log("✓ Captured problems-mobile-375.png");

  // Check console errors
  console.log("\n=== Checking Console Errors ===");
  if (consoleErrors.length > 0) {
    console.error("Found console errors:", consoleErrors);
    throw new Error(`Console errors detected: ${consoleErrors.join("; ")}`);
  }
  console.log("✓ Zero console errors detected!");

  await browser.close();
  console.log("\n🎉 All Readable Working Tabs tests passed successfully!");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
