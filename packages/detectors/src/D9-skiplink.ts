// D9 — Skip link missing detector
// Fires when a page contains a large block of repeated navigation links (e.g. >= 10)
// before main content, and no skip mechanism is provided at the start of the focus order.
// WCAG 2.4.1 (A) — Minor

import type { DetectorHit, DetectorInput } from "./types.js";

const LONG_NAV_LINK_THRESHOLD = 10;

export function detectD9(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel } = input;

  if (focusStops.length < LONG_NAV_LINK_THRESHOLD) return [];

  // Check if first 3 stops contain a skip link
  const earlyStops = focusStops.slice(0, 3);
  const hasSkipLink = earlyStops.some((s) => {
    const name = s.accessibleName.toLowerCase();
    const sel = s.selector.toLowerCase();
    return (
      name.includes("skip") ||
      sel.includes("skip") ||
      (s.tagName === "a" && (name.includes("main") || name.includes("content")))
    );
  });

  if (hasSkipLink) return [];

  // Check if there is a long block of navigation links before reaching content
  let consecutiveNavLinks = 0;
  let navSelector = "nav";

  for (const stop of focusStops) {
    const isLink = stop.tagName === "a" || stop.role === "link";
    const isInNav =
      stop.selector.includes("nav") ||
      stop.selector.includes("menu") ||
      stop.selector.includes("header");

    if (isLink && isInNav) {
      consecutiveNavLinks++;
      if (stop.selector.includes("nav")) {
        navSelector = "nav";
      }
    } else if (!isInNav && stop.tagName !== "a") {
      // Reached non-nav content
      break;
    }
  }

  if (consecutiveNavLinks >= LONG_NAV_LINK_THRESHOLD) {
    return [
      {
        detectorId: "D9",
        selector: navSelector,
        stateLabel,
        stopIndexes: focusStops.slice(0, consecutiveNavLinks).map((s) => s.index),
        evidence: `Page contains ${consecutiveNavLinks} repetitive navigation links before main content with no skip link detected in initial focus sequence. A keyboard user must press Tab ${consecutiveNavLinks} times on every page load to reach primary content.`,
        confidence: 0.95,
        severity: "minor",
        wcagId: "2.4.1",
      },
    ];
  }

  return [];
}
