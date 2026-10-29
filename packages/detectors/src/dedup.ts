// dedup.ts — Hit deduplication and ranking logic for @blindspot/detectors.
// Rules:
// 1. A container/selector can emit one hit per distinct WCAG criterion (e.g. 2.1.2 AND 2.4.3).
// 2. D1 (2.1.2 Keyboard Trap, Blocker) is never swallowed by D8 (2.4.3 Dialog Focus Mismanagement).
// 3. For duplicate hits sharing the same WCAG criterion on the same selector, rank by severity:
//    blocker > major > minor, then by confidence.

import type { DetectorHit, Severity } from "./types.js";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  blocker: 3,
  major: 2,
  minor: 1,
};

/**
 * Deduplicates detector hits so each target selector emits at most one hit per distinct WCAG criterion,
 * strictly prioritizing Blocker over Major (ensuring D1 is never swallowed by D8).
 */
export function deduplicateHits(hits: DetectorHit[]): DetectorHit[] {
  if (hits.length <= 1) return hits;

  const result: DetectorHit[] = [];
  // Key: selector + "::" + wcagId
  const seenKeyToHit = new Map<string, DetectorHit>();

  for (const hit of hits) {
    const key = `${hit.selector.trim().toLowerCase()}::${hit.wcagId.trim()}`;
    const existing = seenKeyToHit.get(key);

    if (!existing) {
      seenKeyToHit.set(key, hit);
      result.push(hit);
    } else {
      // If same selector and same WCAG ID, choose higher severity or higher confidence
      const existingWeight = SEVERITY_WEIGHT[existing.severity] ?? 0;
      const hitWeight = SEVERITY_WEIGHT[hit.severity] ?? 0;

      if (hitWeight > existingWeight || (hitWeight === existingWeight && hit.confidence > existing.confidence)) {
        // Replace existing hit in result array
        const idx = result.indexOf(existing);
        if (idx !== -1) {
          result[idx] = hit;
        }
        seenKeyToHit.set(key, hit);
      }
    }
  }

  // Ensure D1 (Keyboard Trap) is never suppressed if another dialog hit exists
  const hasD1 = result.some((h) => h.detectorId === "D1");
  if (!hasD1) {
    const rawD1 = hits.find((h) => h.detectorId === "D1");
    if (rawD1) {
      result.unshift(rawD1);
    }
  }

  // Sort by severity descending (blocker > major > minor), prioritizing D1
  result.sort((a, b) => {
    const wA = SEVERITY_WEIGHT[a.severity] ?? 0;
    const wB = SEVERITY_WEIGHT[b.severity] ?? 0;
    if (wB !== wA) return wB - wA;
    if (a.detectorId === "D1" && b.detectorId !== "D1") return -1;
    if (b.detectorId === "D1" && a.detectorId !== "D1") return 1;
    return b.confidence - a.confidence;
  });

  return result;
}
