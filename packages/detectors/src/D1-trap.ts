// D1 — Keyboard Trap detector
// Fires when Tab and Shift+Tab visit the same small set of elements
// and never reach the rest of the page. Escape must also fail to escape.
// WCAG 2.1.2 (A) — Blocker

import type { DetectorHit, DetectorInput } from "./types.js";

/** Minimum number of consecutive stops that must cycle before declaring a trap */
const TRAP_CYCLE_THRESHOLD = 3;
/** Max unique selectors in a cycle — if only a few elements repeat, it's a trap */
const MAX_TRAP_SELECTORS = 8;

export function detectD1(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel, interactions, candidateInteractives } = input;

  if (focusStops.length < TRAP_CYCLE_THRESHOLD) return [];

  // Build a sequence of selectors
  const selectors = focusStops.map((s) => s.selector);
  const uniqueSelectors = new Set(selectors);

  // If total stops is much greater than unique selectors, cycling is happening
  if (uniqueSelectors.size > MAX_TRAP_SELECTORS) return [];
  if (focusStops.length < uniqueSelectors.size * 2) return [];

  // Confirm cycling: the second half of stops should repeat the first half
  const half = Math.floor(focusStops.length / 2);
  const firstHalf = selectors.slice(0, half);
  const secondHalf = selectors.slice(half);

  let cycleMatches = 0;
  for (const sel of secondHalf) {
    if (firstHalf.includes(sel)) cycleMatches++;
  }

  const cycleRatio = cycleMatches / secondHalf.length;
  if (cycleRatio < 0.7) return [];

  // Additional check: is Escape handled? Check interaction records.
  // If any interaction on a stop inside the cycle has escapeClosed=true, it's not a trap.
  const cycleSelectorSet = uniqueSelectors;
  const escapeWorked = interactions.some(
    (i) => cycleSelectorSet.has(i.triggerSelector) && i.escapeClosed
  );

  if (escapeWorked) return [];

  // Find the dialog/widget containing the trapped stops
  const trappedInDialog = focusStops.some((s) => s.insideOpenDialog);

  // A keyboard trap occurs if cycling occurs inside a dialog,
  // OR if there are other controls on the page that cannot be reached.
  const hasUnreachedControls = candidateInteractives.length > uniqueSelectors.size;
  if (!trappedInDialog && !hasUnreachedControls) return [];

  const representativeStop = focusStops[0];

  const hit: DetectorHit = {
    detectorId: "D1",
    selector: representativeStop?.selector ?? "body",
    stateLabel,
    stopIndexes: focusStops.map((s) => s.index),
    evidence: `Focus cycles among ${uniqueSelectors.size} elements across ${focusStops.length} stops. ${trappedInDialog ? "Trapped inside an open dialog." : ""} Escape did not free focus.`,
    confidence: 1,
    severity: "blocker",
    wcagId: "2.1.2",
  };

  return [hit];
}
