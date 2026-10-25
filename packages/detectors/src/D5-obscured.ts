// D5 — Focus Obscured detector
// Fires when the center of the focused element's bounding box is covered by another element
// (e.g., a sticky header or cookie banner).
// WCAG 2.4.11 (AA) — Major

import type { DetectorHit, DetectorInput } from "./types.js";

export function detectD5(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel } = input;
  const hits: DetectorHit[] = [];
  const seenSelectors = new Set<string>();

  for (const stop of focusStops) {
    if (seenSelectors.has(stop.selector)) continue;
    seenSelectors.add(stop.selector);

    if (!stop.obscuredBy) continue;

    // Avoid false positives for self-overlap (e.g., parent covering child)
    if (stop.obscuredBy === stop.selector) continue;

    hits.push({
      detectorId: "D5",
      selector: stop.selector,
      stateLabel,
      stopIndexes: [stop.index],
      evidence: `The center of the focused element (${stop.tagName}[role="${stop.role}"]) is covered by '${stop.obscuredBy}'. This is likely a sticky header or fixed banner obscuring the focused control.`,
      confidence: 1,
      severity: "major",
      wcagId: "2.4.11",
    });
  }

  return hits;
}
