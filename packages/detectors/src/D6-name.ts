// D6 — Missing Accessible Name detector
// Fires when an interactive element in the focus path has an empty accessible name.
// Reads from the accessibleName field recorded during the crawl (from the accessibility tree).
// WCAG 4.1.2 (A) — Major

import type { DetectorHit, DetectorInput } from "./types.js";

/** Tags where a missing name is significant */
const NAMED_TAGS = new Set([
  "button", "a", "input", "select", "textarea",
  "img", "svg",
]);

const NAMED_ROLES = new Set([
  "button", "link", "checkbox", "radio", "textbox", "combobox",
  "listbox", "menuitem", "tab", "slider", "switch",
  "img", "figure",
]);

/** Names that are meaningless — emoji or single characters without context */
function isMeaninglessName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0) return true;
  // Single emoji: no semantic value
  if (/^\p{Emoji}$/u.test(trimmed)) return true;
  // Single punctuation or symbol character
  if (/^[☰▼►▲◄●◦▸▾→←↑↓⋮⋯…]$/.test(trimmed)) return true;
  return false;
}

export function detectD6(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel } = input;
  const hits: DetectorHit[] = [];
  const seenSelectors = new Set<string>();

  for (const stop of focusStops) {
    if (seenSelectors.has(stop.selector)) continue;
    seenSelectors.add(stop.selector);

    const isInteractive =
      NAMED_TAGS.has(stop.tagName) || NAMED_ROLES.has(stop.role.toLowerCase());

    if (!isInteractive) continue;

    if (isMeaninglessName(stop.accessibleName)) {
      hits.push({
        detectorId: "D6",
        selector: stop.selector,
        stateLabel,
        stopIndexes: [stop.index],
        evidence: `Interactive element (${stop.tagName}[role="${stop.role}"]) has an empty or meaningless accessible name: "${stop.accessibleName}". Screen readers will announce only the role.`,
        confidence: 1,
        severity: "major",
        wcagId: "4.1.2",
      });
    }
  }

  return hits;
}
