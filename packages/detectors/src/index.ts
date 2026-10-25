// index.ts — entry point for @blindspot/detectors.
// Exports individual pure detectors D1–D9 and the unified runner runDetectors().

import type { DetectorHit, DetectorInput } from "./types.js";
import { detectD1 } from "./D1-trap.js";
import { detectD2 } from "./D2-unreachable.js";
import { detectD3 } from "./D3-invisible.js";
import { detectD4 } from "./D4-order.js";
import { detectD5 } from "./D5-obscured.js";
import { detectD6 } from "./D6-name.js";
import { detectD7 } from "./D7-tabindex.js";
import { detectD8 } from "./D8-dialog.js";
import { detectD9 } from "./D9-skiplink.js";

export * from "./types.js";
export { detectD1 } from "./D1-trap.js";
export { detectD2 } from "./D2-unreachable.js";
export { detectD3 } from "./D3-invisible.js";
export { detectD4 } from "./D4-order.js";
export { detectD5 } from "./D5-obscured.js";
export { detectD6 } from "./D6-name.js";
export { detectD7 } from "./D7-tabindex.js";
export { detectD8 } from "./D8-dialog.js";
export { detectD9 } from "./D9-skiplink.js";

/** Runs all deterministic and heuristic detectors against the provided input. */
export function runDetectors(input: DetectorInput): DetectorHit[] {
  const hits: DetectorHit[] = [
    ...detectD1(input),
    ...detectD2(input),
    ...detectD3(input),
    ...detectD4(input),
    ...detectD5(input),
    ...detectD6(input),
    ...detectD7(input),
    ...detectD8(input),
    ...detectD9(input),
  ];

  return hits;
}
