// D7 — Positive tabindex detector
// Fires when an element visited in the focus sequence has a positive tabindex attribute (tabindex > 0).
// Positive tabindex overrides the natural DOM reading order and makes keyboard navigation unpredictable.
// WCAG 2.4.3 (A) — Major

import type { DetectorHit, DetectorInput } from "./types.js";

export function detectD7(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel } = input;
  const hits: DetectorHit[] = [];
  const seenSelectors = new Set<string>();

  for (const stop of focusStops) {
    if (seenSelectors.has(stop.selector)) continue;
    seenSelectors.add(stop.selector);

    if (stop.tabIndex !== undefined && stop.tabIndex > 0) {
      hits.push({
        detectorId: "D7",
        selector: stop.selector,
        stateLabel,
        stopIndexes: [stop.index],
        evidence: `Element '${stop.selector}' has an explicit positive tabindex="${stop.tabIndex}". Positive tabindex values disrupt logical tab order and should be replaced with tabindex="0" or native source ordering.`,
        confidence: 1,
        severity: "major",
        wcagId: "2.4.3",
      });
    }
  }

  return hits;
}
