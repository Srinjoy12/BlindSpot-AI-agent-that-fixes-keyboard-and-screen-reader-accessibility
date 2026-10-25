// D4 — Focus Order Mismatch detector
// Fires when Tab order contradicts visual reading order by more than a threshold.
// Uses bounding box Y positions as a proxy for visual order.
// WCAG 2.4.3 (A) — Major

import type { DetectorHit, DetectorInput } from "./types.js";

/** Fraction of stop pairs that must be inverted to flag a mismatch */
const INVERSION_THRESHOLD = 0.3;
/** Vertical tolerance in pixels — elements within this vertical distance are considered same-row */
const SAME_ROW_TOLERANCE = 40;

export function detectD4(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel } = input;

  // Deduplicate stops by unique selector — only compare unique elements in first-visited order
  const uniqueSeen = new Set<string>();
  const stops = focusStops
    .filter((s) => s.box.height > 0 && s.box.width > 0 && s.inViewport)
    .filter((s) => {
      if (uniqueSeen.has(s.selector)) return false;
      uniqueSeen.add(s.selector);
      return true;
    });

  if (stops.length < 4) return []; // Too few stops to determine order

  // Compare tab order against visual reading order (top-to-bottom, left-to-right)
  // Count inversions: pairs where visual order contradicts tab order
  let inversions = 0;
  let comparisons = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      const a = stops[i];
      const b = stops[j];

      if (!a || !b) continue;

      const docY_A = a.box.y + a.scrollY;
      const docY_B = b.box.y + b.scrollY;

      // If they're on the same row (within tolerance), compare by X
      const sameRow = Math.abs(docY_A - docY_B) < SAME_ROW_TOLERANCE;

      const visuallyBefore = sameRow
        ? a.box.x <= b.box.x // same row: left element comes first
        : docY_A < docY_B; // different rows: top element comes first

      // Tab order says i comes before j
      // If visual order says j should come before i, that's an inversion
      if (!visuallyBefore) inversions++;
      comparisons++;
    }
  }

  if (comparisons === 0) return [];

  const inversionRatio = inversions / comparisons;
  if (inversionRatio < INVERSION_THRESHOLD) return [];

  // Find the worst offender — the stop that appears furthest from its visual position
  const worstStop = stops.reduce((worst, stop, tabIdx) => {
    const visualIdx = [...stops].sort((a, b) => {
      const docY_A = a.box.y + a.scrollY;
      const docY_B = b.box.y + b.scrollY;
      if (Math.abs(docY_A - docY_B) < SAME_ROW_TOLERANCE) return a.box.x - b.box.x;
      return docY_A - docY_B;
    }).indexOf(stop);

    const displacement = Math.abs(tabIdx - visualIdx);
    return displacement > worst.displacement ? { stop, displacement } : worst;
  }, { stop: stops[0]!, displacement: 0 });

  return [
    {
      detectorId: "D4",
      selector: worstStop.stop.selector,
      stateLabel,
      stopIndexes: stops.map((s) => s.index),
      evidence: `Focus order contradicts visual reading order. ${Math.round(inversionRatio * 100)}% of stop pairs are inverted. Worst offender: tab position ${stops.indexOf(worstStop.stop)} vs visual position.`,
      confidence: 0.9,
      severity: "major",
      wcagId: "2.4.3",
    },
  ];
}
