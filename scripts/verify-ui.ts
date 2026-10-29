import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const outDir = path.resolve(process.cwd(), "docs/screenshots/after");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 1440, height: 900, name: "desktop-1440.png" },
    { width: 1024, height: 768, name: "tablet-1024.png" },
    { width: 390, height: 844, name: "mobile-390.png" },
  ];

  const consoleErrors: string[] = [];

  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(`[${vp.name}] ${msg.text()}`);
      }
    });

    page.on("pageerror", (err) => {
      consoleErrors.push(`[${vp.name}] Page error: ${err.message}`);
    });

    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const targetPath = path.join(outDir, vp.name);
    await page.screenshot({ path: targetPath, fullPage: true });
    console.log(`Saved screenshot: ${targetPath}`);

    // If desktop, also test theme toggle to light theme and take light screenshot
    if (vp.width === 1440) {
      const toggleBtn = page.getByRole("button", { name: /light theme/i });
      if (await toggleBtn.isVisible()) {
        await toggleBtn.click();
        await page.waitForTimeout(500);
        const lightPath = path.join(outDir, "desktop-1440-light.png");
        await page.screenshot({ path: lightPath, fullPage: true });
        console.log(`Saved light theme screenshot: ${lightPath}`);

        // Toggle back to dark
        const darkBtn = page.getByRole("button", { name: /dark theme/i });
        if (await darkBtn.isVisible()) {
          await darkBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    await page.close();
  }

  await browser.close();

  console.log("\nConsole errors check:");
  if (consoleErrors.length === 0) {
    console.log("✓ Zero console errors detected!");
  } else {
    console.error("❌ Console errors found:");
    for (const e of consoleErrors) {
      console.error("  ", e);
    }
  }
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
