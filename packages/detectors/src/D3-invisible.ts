// D3 — Focus Not Visible detector
// Fires when a focused element has no outline, box-shadow, border change, or background change.
// WCAG 2.4.7 (AA) — Blocker (primary controls), Major (others)

import type { DetectorHit, DetectorInput, FocusStopLite } from "./types.js";

function hasFocusIndicator(stop: FocusStopLite): boolean {
  const { focusIndicator } = stop;
  return (
    focusIndicator.hasOutline ||
    focusIndicator.hasBoxShadow ||
    focusIndicator.hasBorderChange ||
    focusIndicator.hasBackgroundChange
  );
}

/** Interactive tags and roles where invisible focus is a blocker */
const BLOCKER_TAGS = new Set(["button", "a", "input", "select", "textarea"]);
const BLOCKER_ROLES = new Set([
  "button", "link", "textbox", "combobox", "listbox",
  "checkbox", "radio", "menuitem", "tab", "slider",
]);

export function detectD3(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel } = input;
  const hits: DetectorHit[] = [];
  const seenSelectors = new Set<string>();

  // Only report forward-pass stops to avoid duplicate hits
  const forwardStops = focusStops.filter((s) => !seenSelectors.has(s.selector));

  for (const stop of forwardStops) {
    seenSelectors.add(stop.selector);

    if (hasFocusIndicator(stop)) continue;

    const isBlocker =
      BLOCKER_TAGS.has(stop.tagName) || BLOCKER_ROLES.has(stop.role.toLowerCase());

    hits.push({
      detectorId: "D3",
      selector: stop.selector,
      stateLabel,
      stopIndexes: [stop.index],
      evidence: `No outline, box-shadow, border or background change detected when element is focused. tag=${stop.tagName}, role=${stop.role}.`,
      confidence: 1,
      severity: isBlocker ? "blocker" : "major",
      wcagId: "2.4.7",
    });
  }

  return hits;
}
