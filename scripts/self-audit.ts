import { chromium } from "playwright";
import { startSession, crawl, runInteractionPass, runAxe } from "@blindspot/engine";
import { runDetectors } from "@blindspot/detectors";

async function main() {
  console.log("=== BlindSpot Self-Audit: Running on http://localhost:3000 ===");

  // 1. Run Engine + Detectors on http://localhost:3000
  console.log("1. Starting engine session on http://localhost:3000...");
  const session = await startSession({ auditId: "self-audit-test", targetUrl: "http://localhost:3000" });
  
  console.log("2. Running axe-core baseline...");
  const axeResult = await runAxe(session.page);
  console.log(`   axe-core reported ${axeResult.violationCount} violations.`);
  if (axeResult.rules && axeResult.rules.length > 0) {
    for (const v of axeResult.rules) {
      console.log(`   - [${v.ruleId}] ${v.description || ""} (${v.nodeCount} nodes)`);
      for (const target of v.selectors.slice(0, 3)) {
        console.log(`     target: ${target}`);
      }
    }
  }

  console.log("3. Running forward and backward keyboard crawl...");
  const crawlResult = await crawl(session.page, { maxStops: 100, pauseMs: 50 });
  console.log(`   Captured ${crawlResult.forwardStops.length} forward stops, ${crawlResult.backwardStops.length} backward stops.`);

  console.log("4. Running interaction pass...");
  const interactionResult = await runInteractionPass(session.page, { count: 3 });

  console.log("5. Evaluating candidate elements for D2...");
  const candidateData = (await session.page.evaluate(`(() => {
    function getSelector(el) {
      if (el.id) return "#" + CSS.escape(el.id);
      const path = [];
      let current = el;
      while (current && current !== document.body) {
        let seg = current.tagName.toLowerCase();
        if (current.id) { seg = "#" + CSS.escape(current.id); path.unshift(seg); break; }
        const siblings = Array.from(current.parentElement ? current.parentElement.children : []).filter(
          (c) => c.tagName === current.tagName
        );
        if (siblings.length > 1) seg += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        path.unshift(seg);
        current = current.parentElement;
      }
      return path.join(" > ");
    }

    const selectors = [];
    document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [role='tab'], [tabindex], [onclick]").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      const sel = getSelector(el);
      if (sel && !selectors.includes(sel)) selectors.push(sel);
    });
    return { selectors, hoverTriggers: [] };
  })()`)) as any;

  console.log("6. Running deterministic detectors D1-D9...");
  const detectorResult = runDetectors({
    stateLabel: "S0",
    focusStops: crawlResult.forwardStops,
    interactions: interactionResult.interactions,
    candidateInteractives: candidateData.selectors,
  });

  console.log(`   Detectors found ${detectorResult.length} barriers.`);
  for (const b of detectorResult) {
    console.log(`   - [${b.detectorId}] (${b.severity}) ${b.wcagId}: ${b.evidence} on ${b.selector}`);
  }

  await session.context.close();
  await session.browser.close();

  // 2. Playwright Verification of Interactive Accessibility Requirements
  console.log("\n=== Checking Interactive Accessibility Requirements ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // A. Headings in order
  console.log("\nA. Checking heading hierarchy...");
  const headings = await page.$$eval("h1, h2, h3, h4, h5, h6", (els) =>
    els.map((el) => ({
      level: parseInt(el.tagName.slice(1), 10),
      text: el.textContent?.trim(),
      tag: el.tagName.toLowerCase(),
    }))
  );
  console.log("   Found headings:", headings);
  let headingOrderValid = true;
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1]!;
    const curr = headings[i]!;
    if (curr.level > prev.level + 1) {
      console.warn(`   ⚠️ Heading skip: ${prev.tag} ("${prev.text}") followed by ${curr.tag} ("${curr.text}")`);
      headingOrderValid = false;
    }
  }
  if (headingOrderValid) console.log("   ✓ Heading hierarchy is valid (no skipped levels).");

  // B. Tab pattern & Roving tabIndex
  console.log("\nB. Checking tab pattern...");
  const tablist = await page.$('[role="tablist"]');
  const tabs = await page.$$('[role="tab"]');
  console.log(`   Found tablist: ${Boolean(tablist)}, Tabs count: ${tabs.length}`);
  
  // Test Arrow navigation on tabs
  const firstTab = tabs[0];
  if (firstTab) {
    await firstTab.focus();
    const activeBefore = await page.evaluate(() => document.activeElement?.id);
    await page.keyboard.press("ArrowRight");
    const activeAfter = await page.evaluate(() => document.activeElement?.id);
    console.log(`   ArrowRight navigation: from #${activeBefore} to #${activeAfter}`);
  }

  // C. Labelled inputs
  console.log("\nC. Checking input labelling...");
  const formControls = await page.$$eval("input, select, textarea", (els) =>
    els.map((el) => {
      const inputEl = el as HTMLInputElement;
      const id = inputEl.id;
      const ariaLabel = inputEl.getAttribute("aria-label");
      const ariaLabelledBy = inputEl.getAttribute("aria-labelledby");
      const hasAssociatedLabel = id ? Boolean(document.querySelector(`label[for="${CSS.escape(id)}"]`)) : false;
      const isWrappedInLabel = Boolean(inputEl.closest("label"));
      const isHidden = inputEl.type === "hidden" || window.getComputedStyle(inputEl).display === "none";
      return {
        id,
        type: inputEl.type,
        hasLabel: Boolean(ariaLabel || ariaLabelledBy || hasAssociatedLabel || isWrappedInLabel),
        isHidden,
      };
    })
  );
  const unlabelled = formControls.filter((c) => !c.hasLabel && !c.isHidden);
  if (unlabelled.length === 0) {
    console.log(`   ✓ All ${formControls.length} inputs have valid accessible labels.`);
  } else {
    console.warn(`   ⚠️ Found ${unlabelled.length} unlabelled controls:`, unlabelled);
  }

  // D. aria-live for progress
  console.log("\nD. Checking aria-live regions...");
  const liveRegions = await page.$$eval("[aria-live]", (els) =>
    els.map((el) => ({
      live: el.getAttribute("aria-live"),
      role: el.getAttribute("role"),
      id: el.id,
      text: el.textContent?.trim().slice(0, 60),
    }))
  );
  console.log(`   Found ${liveRegions.length} aria-live regions:`, liveRegions);

  // E. Focus rings (2px, 3:1 contrast, offset)
  console.log("\nE. Checking focus rings on key controls...");
  const buttonSelectors = ["#theme-toggle-button", "#tab-url", "#tab-code", "#audit-submit-button"];
  for (const sel of buttonSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.focus();
      const focusRing = await page.evaluate((selector) => {
        const target = document.querySelector(selector);
        if (!target) return null;
        const style = window.getComputedStyle(target);
        return {
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          outlineColor: style.outlineColor,
          outlineOffset: style.outlineOffset,
        };
      }, sel);
      console.log(`   Focus style for ${sel}:`, focusRing);
    }
  }

  // F. Zoom to 200% without loss / horizontal scroll
  console.log("\nF. Checking zoom to 200% without loss / horizontal scroll...");
  // Simulate 200% zoom by setting viewport to 640x450 (or 2x scale)
  await page.setViewportSize({ width: 640, height: 480 });
  const hasHorizontalScrollAt200 = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  console.log(`   Horizontal scroll at 640px (simulated 200% zoom of 1280px): ${hasHorizontalScrollAt200 ? "DETECTED (FAIL)" : "NONE (PASS)"}`);

  await browser.close();
  console.log("\n=== Self-Audit Complete ===");
}

main().catch(console.error);
