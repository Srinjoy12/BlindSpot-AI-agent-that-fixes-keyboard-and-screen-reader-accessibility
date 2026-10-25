// D2 — Unreachable Control detector
// Fires when candidate interactive elements never receive keyboard focus during the crawl.
// WCAG 2.1.1 (A) — Blocker (primary controls) / Major (secondary)

import type { DetectorHit, DetectorInput } from "./types.js";

export function detectD2(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel, candidateInteractives } = input;

  if (candidateInteractives.length === 0) return [];

  const reachedSelectors = new Set(focusStops.map((s) => s.selector));

  const hits: DetectorHit[] = [];

  for (const candidate of candidateInteractives) {
    // Check if ANY focus stop selector matches (exact or starts-with for nth-of-type)
    const reached = [...reachedSelectors].some(
      (r) => r === candidate || r.includes(candidate.split(" ").pop() ?? "")
    );

    if (!reached) {
      hits.push({
        detectorId: "D2",
        selector: candidate,
        stateLabel,
        stopIndexes: [],
        evidence: `Interactive element never received focus during the Tab crawl of ${focusStops.length} stops.`,
        confidence: 0.85, // heuristic portion: some candidate detection may miss edge cases
        severity: "blocker",
        wcagId: "2.1.1",
      });
    }
  }

  return hits;
}
