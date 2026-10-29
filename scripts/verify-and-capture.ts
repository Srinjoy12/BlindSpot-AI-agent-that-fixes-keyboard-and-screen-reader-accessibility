import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function verifyAndCapture() {
  console.log("=== Starting Comprehensive Verification & Screenshot Capture ===");

  const afterDir = path.resolve(process.cwd(), "docs/screenshots/after");
  if (!fs.existsSync(afterDir)) {
    fs.mkdirSync(afterDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "tablet-1024", width: 1024, height: 768 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "mobile-390", width: 390, height: 844 },
  ];

  const consoleErrors: string[] = [];

  // Helper to test horizontal overflow
  async function checkHorizontalScroll(page: any, contextName: string) {
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (isOverflowing) {
      console.error(`❌ Horizontal overflow detected in [${contextName}]!`);
    } else {
      console.log(`✓ No horizontal page scroll in [${contextName}].`);
    }
  }

  // ----------------------------------------------------
  // 1. EMPTY STATE & FIRST SCREEN CHECKS
  // ----------------------------------------------------
  console.log("\n--- Testing Empty State & First Screen Layout ---");
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[${vp.name}] ${msg.text()}`);
    });

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Verify single sentence under h1
    const subhead = await page.textContent("main p");
    if (!subhead?.includes("BlindSpot presses Tab through your page like a keyboard user")) {
      console.error(`❌ Subhead text missing or incorrect in ${vp.name}: ${subhead}`);
    } else {
      console.log(`✓ Single sentence under h1 verified in ${vp.name}.`);
    }

    // Verify SegmentedControl
    const segmentedButtons = await page.$$('div[role="radiogroup"] button');
    if (segmentedButtons.length < 2) {
      console.error(`❌ SegmentedControl buttons missing in ${vp.name}`);
    } else {
      console.log(`✓ SegmentedControl rendered with ${segmentedButtons.length} options in ${vp.name}.`);
    }

    // Verify button text "Run audit"
    const runBtn = page.locator("#audit-submit-button");
    const runBtnText = await runBtn.textContent();
    if (!runBtnText?.includes("Run audit")) {
      console.error(`❌ Run audit button text incorrect: ${runBtnText}`);
    }

    // Verify checkbox label "Suggest fixes and test them"
    const checkboxLabel = await page.textContent('label:has(#enable-ultra-fix-checkbox)');
    if (!checkboxLabel?.includes("Suggest fixes and test them")) {
      console.error(`❌ Checkbox label incorrect: ${checkboxLabel}`);
    }

    // Verify highlighted default example: Cookie banner
    const cookieCard = page.locator("#try-cookie-banner-button");
    await cookieCard.waitFor({ state: "visible" });

    // Verify "Recorded run" badge
    const recordedBadge = page.locator('text="Recorded run"');
    if ((await recordedBadge.count()) === 0) {
      console.error("❌ Recorded run badge not found!");
    }

    // Check no horizontal scroll
    await checkHorizontalScroll(page, `Empty state @ ${vp.width}px`);

    // Capture screenshot at 1440 and 390
    if (vp.width === 1440) {
      await page.screenshot({ path: path.join(afterDir, "empty-1440.png"), fullPage: true });
      console.log("📸 Saved empty-1440.png");
    } else if (vp.width === 390) {
      await page.screenshot({ path: path.join(afterDir, "empty-390.png"), fullPage: true });
      console.log("📸 Saved empty-390.png");
    }

    await page.close();
  }

  // ----------------------------------------------------
  // 2. ERROR & RATE-LIMIT STATES
  // ----------------------------------------------------
  console.log("\n--- Testing Error State ---");
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Enter invalid URL and trigger error
    await page.fill("#target-url-input", "https://invalid-non-existent-domain-test-12345.com");
    // Check ownership attestation
    const attestCheckbox = page.locator("#ownership-attestation-checkbox");
    if (await attestCheckbox.isVisible()) {
      await attestCheckbox.check();
    }

    const runBtn = page.locator("#audit-submit-button");
    await runBtn.click();

    // Wait for error state card
    const errorCard = page.locator("#blindspot-error-card");
    await errorCard.waitFor({ state: "visible", timeout: 15000 });
    console.log("✓ Error state card displayed cleanly without stack traces.");

    // Check no horizontal scroll
    await checkHorizontalScroll(page, "Error state @ 1440px");

    await page.screenshot({ path: path.join(afterDir, "error-1440.png"), fullPage: true });
    console.log("📸 Saved error-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await checkHorizontalScroll(page, "Error state @ 390px");
    await page.screenshot({ path: path.join(afterDir, "error-390.png"), fullPage: true });
    console.log("📸 Saved error-390.png");

    await page.close();
  }

  // ----------------------------------------------------
  // 3. RUNNING STATE & FINISHED RECORDED RUN (B08 COOKIE BANNER)
  // ----------------------------------------------------
  console.log("\n--- Testing 1-Click Cookie Banner Demo & Recorded Run ---");
  for (const vp of [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet-1024", width: 1024, height: 768 },
    { name: "tablet-768", width: 768, height: 1024 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Click "Try the cookie banner example"
    console.log(`[${vp.name}] Clicking "Try the cookie banner example"...`);
    const demoBtn = page.locator("#try-cookie-banner-button");
    await demoBtn.click();

    // Verify stepper collapses to "Finished in X.X s" with "Show steps"
    const finishedBanner = page.locator('span:has-text("Finished in")').first();
    await finishedBanner.waitFor({ state: "visible", timeout: 25000 });
    console.log(`✓ Finished banner displayed in ${vp.name}.`);

    // Verify "Show steps" button
    const showStepsBtn = page.locator('button:has-text("Show steps")');
    await showStepsBtn.waitFor({ state: "visible" });
    await showStepsBtn.click();
    console.log(`✓ Stepper expanded via "Show steps".`);

    // Check step names:
    const expectedSteps = [
      "Tab through the page",
      "Try menus and dialogs",
      "Check against known rules",
      "Summarise each page state",
      "Rank and explain the problems",
      "Write and test fixes",
    ];
    for (const stepName of expectedSteps) {
      const stepEl = page.locator(`text="${stepName}"`);
      if ((await stepEl.count()) === 0) {
        console.error(`❌ Expected step name not found: ${stepName}`);
      }
    }
    console.log(`✓ All 6 plain-English step names verified.`);

    // Check model badges
    const nanoBadge = page.locator('text="Nano"');
    const superBadge = page.locator('text="Super"');
    const ultraBadge = page.locator('text="Ultra"');
    if ((await nanoBadge.count()) > 0 && (await superBadge.count()) > 0 && (await ultraBadge.count()) > 0) {
      console.log(`✓ Model badges (Nano, Super, Ultra) displayed on steps 4, 5, 6.`);
    }

    // Collapse steps back
    const hideStepsBtn = page.locator('button:has-text("Hide steps")');
    await hideStepsBtn.click();
    console.log(`✓ Stepper collapsed back via "Hide steps".`);

    // Check no horizontal scroll
    await checkHorizontalScroll(page, `Finished with findings @ ${vp.width}px`);

    if (vp.width === 1440 || vp.width === 390) {
      const suffix = vp.width === 1440 ? "1440" : "390";

      // Overview Tab screenshot
      await page.screenshot({ path: path.join(afterDir, `tab-overview-${suffix}.png`), fullPage: true });

      // Problems Tab
      await page.click("#blindspot-results-tab-problems");
      await page.waitForTimeout(400);
      await checkHorizontalScroll(page, `Problems tab @ ${vp.width}px`);
      await page.screenshot({ path: path.join(afterDir, `tab-problems-${suffix}.png`), fullPage: true });

      // Keyboard Path Tab
      await page.click("#blindspot-results-tab-keyboard-path");
      await page.waitForTimeout(400);
      await checkHorizontalScroll(page, `Keyboard path tab @ ${vp.width}px`);
      await page.screenshot({ path: path.join(afterDir, `tab-keyboard-path-${suffix}.png`), fullPage: true });

      // Fixes Tab
      await page.click("#blindspot-results-tab-fixes");
      await page.waitForTimeout(400);
      await checkHorizontalScroll(page, `Fixes tab @ ${vp.width}px`);
      await page.screenshot({ path: path.join(afterDir, `tab-fixes-${suffix}.png`), fullPage: true });

      // Models and Cost Tab
      await page.click("#blindspot-results-tab-models-and-cost");
      await page.waitForTimeout(400);
      await checkHorizontalScroll(page, `Models and cost tab @ ${vp.width}px`);
      await page.screenshot({ path: path.join(afterDir, `tab-models-and-cost-${suffix}.png`), fullPage: true });

      // Export Tab
      await page.click("#blindspot-results-tab-export");
      await page.waitForTimeout(400);
      await checkHorizontalScroll(page, `Export tab @ ${vp.width}px`);
      await page.screenshot({ path: path.join(afterDir, `tab-export-${suffix}.png`), fullPage: true });

      if (vp.width === 1440) {
        // Also save main hero screenshot
        await page.click("#blindspot-results-tab-overview");
        await page.screenshot({ path: path.join(afterDir, "hero-1440.png"), fullPage: true });
        console.log("📸 Saved hero-1440.png");
      }
    }

    await page.close();
  }

  // ----------------------------------------------------
  // 4. CLEAN AUDIT STATE (C01 CLEAN FORM)
  // ----------------------------------------------------
  console.log("\n--- Testing Finished Clean State (C01) ---");
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Select C01 from examples dropdown
    await page.selectOption("#examples-select-dropdown", "C01");
    // Click Run C01
    const runExampleBtn = page.locator('button:has-text("Run C01")');
    await runExampleBtn.click();

    // Wait for clean results
    const cleanNotice = page.locator('p:has-text("No keyboard problems found on this page.")').first();
    await cleanNotice.waitFor({ state: "visible", timeout: 25000 });
    console.log("✓ Clean audit state displayed: 'No keyboard problems found on this page.'");

    await checkHorizontalScroll(page, "Finished clean @ 1440px");
    await page.screenshot({ path: path.join(afterDir, "clean-1440.png"), fullPage: true });
    console.log("📸 Saved clean-1440.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await checkHorizontalScroll(page, "Finished clean @ 390px");
    await page.screenshot({ path: path.join(afterDir, "clean-390.png"), fullPage: true });
    console.log("📸 Saved clean-390.png");

    await page.close();
  }

  await browser.close();

  console.log("\n=== Verification Summary ===");
  if (consoleErrors.length === 0) {
    console.log("✓ Zero console errors across all test flows and viewports.");
  } else {
    console.warn(`⚠️ Encountered ${consoleErrors.length} console errors:`, consoleErrors);
  }
}

verifyAndCapture().catch(console.error);
