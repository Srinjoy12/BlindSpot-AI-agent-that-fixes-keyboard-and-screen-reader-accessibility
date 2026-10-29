import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const outDir = path.resolve(process.cwd(), "docs/screenshots/before");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 1440, height: 900, name: "desktop-1440.png" },
    { width: 1024, height: 768, name: "tablet-1024.png" },
    { width: 390, height: 844, name: "mobile-390.png" },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const targetPath = path.join(outDir, vp.name);
    await page.screenshot({ path: targetPath, fullPage: true });
    console.log(`Saved screenshot: ${targetPath}`);
    await page.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error("Screenshot error:", err);
  process.exit(1);
});
