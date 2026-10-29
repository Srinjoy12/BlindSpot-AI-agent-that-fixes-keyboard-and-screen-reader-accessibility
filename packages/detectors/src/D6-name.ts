// D6 — Missing Accessible Name detector
// Fires when an interactive element in the focus path or accessibility tree has an empty or meaningless accessible name.
// Reads from the accessibleName field recorded during the crawl and CDP accessibility tree inspection.
// WCAG 4.1.2 (A) — Major

import type { DetectorHit, DetectorInput } from "./types.js";

/** Genuinely interactive HTML control tags */
const INTERACTIVE_TAGS = new Set(["button", "input", "select", "textarea"]);

/** Explicit interactive ARIA widget roles */
const INTERACTIVE_WIDGET_ROLES = new Set([
  "button",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "combobox",
  "checkbox",
  "switch",
  "radio",
  "slider",
  "spinbutton",
  "searchbox",
  "textbox",
  "listbox",
]);

/** Names that are meaningless — empty, emoji, symbols, or single unlabelled styling characters */
function isMeaninglessName(name?: string | null, hasAriaLabel?: boolean): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length === 0) return true;
  // Emoji string: no semantic text value
  if (/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)+$/u.test(trimmed)) return true;
  // Punctuation, symbols, arrows: e.g. ↺, ↻, ◄, ►, ▼, ▲, etc.
  if (/^[\p{Symbol}\p{Punctuation}\s]+$/u.test(trimmed)) return true;
  // Single letter/number shortcut without explicit label (e.g. bold "B", italic "I", underline "U" buttons)
  if (trimmed.length === 1 && !hasAriaLabel && /^[a-zA-Z0-9]$/.test(trimmed)) return true;
  return false;
}

export function detectD6(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel, interactiveElements, candidateInteractives } = input;
  const hits: DetectorHit[] = [];
  const seenSelectors = new Set<string>();
  const candidates = new Set(candidateInteractives ?? []);

  function processElement(
    selector: string,
    tagName: string,
    role: string,
    accessibleName: string,
    stopIndex?: number,
    hasAriaLabel?: boolean,
    hasHref?: boolean
  ) {
    if (!selector || seenSelectors.has(selector)) return;

    const lowerTag = tagName.toLowerCase();
    const lowerRole = role.toLowerCase();

    // 1. Genuinely interactive controls:
    // - Native form/button controls: button, input, select, textarea
    // - Links: a[href] or <a> reached in keyboard focus crawl
    // - Explicit interactive ARIA widget roles: button, menuitem, tab, combobox, checkbox, switch, etc.
    const isNativeControl = INTERACTIVE_TAGS.has(lowerTag);
    const isInteractiveLink = lowerTag === "a" && (hasHref !== false || stopIndex !== undefined || lowerRole === "link");
    const isExplicitWidget = INTERACTIVE_WIDGET_ROLES.has(lowerRole);

    // 2. Unreached custom widget target:
    // Only flag custom div/span if explicitly captured in candidateInteractives (e.g. #dept-trigger)
    // and not a layout container (toolbar, dialog, region, etc.)
    const isUnreachedCustomWidget =
      !isNativeControl &&
      !isInteractiveLink &&
      !isExplicitWidget &&
      (lowerTag === "div" || lowerTag === "span" || lowerRole === "generic") &&
      stopIndex === undefined &&
      (candidates.has(selector) || Array.from(candidates).some((c) => c && (c === selector || selector.includes(c) || c.includes(selector))));

    const isInteractive = isNativeControl || isInteractiveLink || isExplicitWidget || isUnreachedCustomWidget;
    if (!isInteractive) return;

    if (isMeaninglessName(accessibleName, hasAriaLabel)) {
      seenSelectors.add(selector);
      hits.push({
        detectorId: "D6",
        selector,
        stateLabel,
        stopIndexes: stopIndex !== undefined ? [stopIndex] : [],
        evidence: `Interactive element (${tagName}${role ? `[role="${role}"]` : ""}) has an empty or meaningless accessible name: "${accessibleName}". Screen readers will announce only the role or cannot announce an accessible name.`,
        confidence: 1,
        severity: "major",
        wcagId: "4.1.2",
      });
    }
  }

  // 1. Inspect reached focus stops
  for (const stop of focusStops) {
    processElement(stop.selector, stop.tagName, stop.role, stop.accessibleName, stop.index, false);
  }

  // 2. Inspect full accessibility tree / DOM interactive elements (catches unreached nodes like #dept-trigger)
  if (interactiveElements) {
    for (const el of interactiveElements) {
      processElement(el.selector, el.tagName, el.role, el.accessibleName, undefined, el.hasAriaLabel, el.hasHref);
    }
  }

  return hits;
}

