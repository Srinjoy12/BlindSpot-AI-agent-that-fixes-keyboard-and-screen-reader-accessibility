import { chromium } from "playwright";
import path from "node:path";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Click "Run audit and verify"
  const submitBtn = page.locator("#audit-submit-button");
  console.log("Submitting audit on preset...");
  await submitBtn.click();

  // Wait for audit to complete (PhaseStepper reaches complete or report is rendered)
  console.log("Waiting for results...");
  await page.waitForSelector(".score-hero", { timeout: 45000 });
  await page.waitForTimeout(1000);

  const outPath = path.resolve(process.cwd(), "docs/screenshots/after/audit-results-1440.png");
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved audit results screenshot: ${outPath}`);

  // Also test opening DiffModal
  const inspectBtn = page.getByRole("button", { name: /inspect/i }).first();
  if (await inspectBtn.isVisible()) {
    console.log("Opening diff modal...");
    await inspectBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.waitForTimeout(500);
    const modalPath = path.resolve(process.cwd(), "docs/screenshots/after/modal-diff-1440.png");
    await page.screenshot({ path: modalPath });
    console.log(`Saved modal screenshot: ${modalPath}`);

    // Press Escape to close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  await browser.close();

  if (consoleErrors.length > 0) {
    console.error("Errors during audit:", consoleErrors);
  } else {
    console.log("✓ Audit completed with zero console errors!");
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
