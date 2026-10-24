// crawl.ts — drives the keyboard Tab crawl on a page and records every focus stop.
// Returns an ordered list of FocusStop records with evidence for each detectors.

import type { Page } from "playwright";
import type { FocusStop, FocusIndicator, BoundingBox, CrawlOptions } from "./types.js";

const DEFAULT_MAX_STOPS = 150;
const DEFAULT_BACKWARD_STOPS = 40;
const PAUSE_MS = 80;

// Script to run in the browser to capture focus state for the current activeElement.
const CAPTURE_FOCUS_STATE_SCRIPT = `
(async function captureFocusState() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;

  // Build a unique CSS selector for the element
  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    let path = [];
    let current = el;
    while (current && current !== document.body) {
      let seg = current.tagName.toLowerCase();
      if (current.id) { seg = '#' + CSS.escape(current.id); path.unshift(seg); break; }
      const siblings = Array.from(current.parentElement?.children ?? []).filter(c => c.tagName === current.tagName);
      if (siblings.length > 1) seg += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      path.unshift(seg);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  // Get bounding box
  const rect = el.getBoundingClientRect();
  const box = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

  // Check viewport
  const inViewport = rect.top >= 0 && rect.bottom <= window.innerHeight
    && rect.left >= 0 && rect.right <= window.innerWidth;

  // Check if the element's center is covered by another element
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  let obscuredBy = null;
  const topEl = document.elementFromPoint(cx, cy);
  if (topEl && topEl !== el && !el.contains(topEl)) {
    obscuredBy = getSelector(topEl);
  }

  // Check if inside an open dialog
  let insideOpenDialog = false;
  let parent = el.parentElement;
  while (parent) {
    if ((parent.getAttribute('role') === 'dialog' || parent.tagName === 'DIALOG') 
        && parent.getAttribute('aria-hidden') !== 'true'
        && (parent.open !== false || parent.getAttribute('role') === 'dialog')) {
      insideOpenDialog = true;
      break;
    }
    parent = parent.parentElement;
  }

  // Get scroll position
  const scrollY = window.scrollY;

  // Get ARIA accessible name (simplified)
  const accessibleName = el.getAttribute('aria-label')
    || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby') || '')?.textContent?.trim()
    || el.getAttribute('title')
    || el.textContent?.trim().slice(0, 100)
    || el.getAttribute('placeholder')
    || el.getAttribute('alt')
    || '';

  // Get role
  const role = el.getAttribute('role') || el.tagName.toLowerCase();

  return {
    selector: getSelector(el),
    tagName: el.tagName.toLowerCase(),
    role,
    accessibleName,
    box,
    inViewport,
    obscuredBy,
    insideOpenDialog,
    scrollY,
  };
})()
`;

// Script to measure focus indicator changes
const MEASURE_FOCUS_INDICATOR_SCRIPT = `
(function measureFocusIndicator() {
  const el = document.activeElement;
  if (!el) return { hasOutline: false, hasBoxShadow: false, hasBorderChange: false, hasBackgroundChange: false };
  
  const style = getComputedStyle(el);
  
  // We compare with a known "no focus" style baseline stored before pressing Tab.
  // For simplicity in this MVP, check for non-zero/non-none values.
  const hasOutline = style.outlineWidth !== '0px' && style.outlineStyle !== 'none';
  const hasBoxShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
  const hasBorderChange = false; // Would need before/after comparison
  const hasBackgroundChange = false; // Would need before/after comparison
  
  return {
    hasOutline,
    hasBoxShadow,
    hasBorderChange,
    hasBackgroundChange,
    outlineWidth: parseFloat(style.outlineWidth) || 0,
    outlineColor: style.outlineColor,
  };
})()
`;

export interface CrawlResult {
  forwardStops: FocusStop[];
  backwardStops: FocusStop[];
  cycleDetected: boolean;
  limitHit: "maxStops" | "cycle" | null;
}

/** Runs the forward (Tab) and backward (Shift+Tab) keyboard crawl. */
export async function crawl(page: Page, options: CrawlOptions = {}): Promise<CrawlResult> {
  const maxStops = options.maxStops ?? DEFAULT_MAX_STOPS;
  const backwardStops = options.backwardStops ?? DEFAULT_BACKWARD_STOPS;
  const pauseMs = options.pauseMs ?? PAUSE_MS;

  const forwardStops = await crawlForward(page, maxStops, pauseMs);
  const backwardStopsResult = await crawlBackward(page, backwardStops, pauseMs);

  const cycleDetected = forwardStops.length >= maxStops;
  const limitHit = cycleDetected ? "maxStops" : null;

  return {
    forwardStops,
    backwardStops: backwardStopsResult,
    cycleDetected,
    limitHit,
  };
}

async function crawlForward(page: Page, maxStops: number, pauseMs: number): Promise<FocusStop[]> {
  // Focus body to start
  await page.evaluate(() => (document.body as HTMLElement).focus?.());
  await sleep(pauseMs);

  const stops: FocusStop[] = [];
  const seenSelectors = new Map<string, number>(); // selector → first index seen
  let cycleCount = 0;

  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    await sleep(pauseMs);

    const state = await page.evaluate(CAPTURE_FOCUS_STATE_SCRIPT) as {
      selector: string;
      tagName: string;
      role: string;
      accessibleName: string;
      box: BoundingBox;
      inViewport: boolean;
      obscuredBy: string | null;
      insideOpenDialog: boolean;
      scrollY: number;
    } | null;

    if (!state) continue;

    const focusIndicator = await page.evaluate(MEASURE_FOCUS_INDICATOR_SCRIPT) as FocusIndicator;

    const stop: FocusStop = {
      index: i,
      direction: "forward",
      selector: state.selector,
      tagName: state.tagName,
      role: state.role,
      accessibleName: state.accessibleName,
      box: state.box,
      inViewport: state.inViewport,
      obscuredBy: state.obscuredBy,
      focusIndicator,
      insideOpenDialog: state.insideOpenDialog,
      scrollY: state.scrollY,
    };

    stops.push(stop);

    // Cycle detection: if we see the same selector again at the same position
    if (seenSelectors.has(state.selector)) {
      cycleCount++;
      if (cycleCount >= 3) break; // full cycle confirmed
    } else {
      seenSelectors.set(state.selector, i);
      cycleCount = 0;
    }
  }

  return stops;
}

async function crawlBackward(page: Page, maxStops: number, pauseMs: number): Promise<FocusStop[]> {
  // Focus body to start backward crawl
  await page.evaluate(() => (document.body as HTMLElement).focus?.());
  await sleep(pauseMs);

  const stops: FocusStop[] = [];

  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Shift+Tab");
    await sleep(pauseMs);

    const state = await page.evaluate(CAPTURE_FOCUS_STATE_SCRIPT) as {
      selector: string;
      tagName: string;
      role: string;
      accessibleName: string;
      box: BoundingBox;
      inViewport: boolean;
      obscuredBy: string | null;
      insideOpenDialog: boolean;
      scrollY: number;
    } | null;

    if (!state) continue;

    const focusIndicator = await page.evaluate(MEASURE_FOCUS_INDICATOR_SCRIPT) as FocusIndicator;

    stops.push({
      index: i,
      direction: "backward",
      selector: state.selector,
      tagName: state.tagName,
      role: state.role,
      accessibleName: state.accessibleName,
      box: state.box,
      inViewport: state.inViewport,
      obscuredBy: state.obscuredBy,
      focusIndicator,
      insideOpenDialog: state.insideOpenDialog,
      scrollY: state.scrollY,
    });
  }

  return stops;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
