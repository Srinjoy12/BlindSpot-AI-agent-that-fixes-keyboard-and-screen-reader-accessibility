// types.ts — shared types for all detectors.
// Detectors are pure functions: (session data) → DetectorHit[]

export type DetectorId =
  | "D1" // Keyboard trap
  | "D2" // Unreachable control
  | "D3" // Focus not visible
  | "D4" // Focus order mismatch
  | "D5" // Focus obscured
  | "D6" // Missing accessible name
  | "D7" // Positive tabindex
  | "D8" // Dialog focus mismanaged
  | "D9"; // Skip link missing (heuristic)

export type Severity = "blocker" | "major" | "minor";

export interface DetectorHit {
  detectorId: DetectorId;
  selector: string;
  stateLabel: string;
  /** indices into the FocusStop array that are evidence for this finding */
  stopIndexes: number[];
  evidence: string;
  /** 0–1; deterministic detectors always return 1 */
  confidence: number;
  severity: Severity;
  wcagId: string;
}

// Minimal types for detector inputs (mirrors engine types but avoids circular dep)
export interface FocusStopLite {
  index: number;
  selector: string;
  tagName: string;
  role: string;
  accessibleName: string;
  box: { x: number; y: number; width: number; height: number };
  inViewport: boolean;
  obscuredBy: string | null;
  focusIndicator: {
    hasOutline: boolean;
    hasBoxShadow: boolean;
    hasBorderChange: boolean;
    hasBackgroundChange: boolean;
  };
  insideOpenDialog: boolean;
  scrollY: number;
  tabIndex?: number | undefined;
}

export interface InteractionRecordLite {
  triggerSelector: string;
  openedState?: string | undefined;
  openedDialogSelector?: string | undefined;
  escapeClosed: boolean;
  focusReturnedToTrigger: boolean;
  focusMovedIntoSurface: boolean;
  focusLostAfterClose: boolean;
}

export interface InteractiveElementInfo {
  selector: string;
  tagName: string;
  role: string;
  accessibleName: string;
  hasAriaLabel?: boolean;
  hasHref?: boolean;
}

export interface DetectorInput {
  stateLabel: string;
  focusStops: FocusStopLite[];
  interactions: InteractionRecordLite[];
  /** raw candidate interactive elements (selectors) found in the DOM */
  candidateInteractives: string[];
  /** all interactive elements captured from AXTree / DOM */
  interactiveElements?: InteractiveElementInfo[];
}

