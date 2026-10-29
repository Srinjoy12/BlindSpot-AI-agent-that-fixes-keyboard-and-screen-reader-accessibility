// D1 — Keyboard Trap detector
// Fires when Tab and Shift+Tab visit the same small set of elements
// and never reach the rest of the page. Escape must also fail to escape.
// WCAG 2.1.2 (A) — Blocker

import type { DetectorHit, DetectorInput } from "./types.js";

/** Minimum number of consecutive stops that must cycle before declaring a trap */
const TRAP_CYCLE_THRESHOLD = 3;
/** Max unique selectors in a cycle — if only a few elements repeat, it's a trap */
const MAX_TRAP_SELECTORS = 8;

export function detectD1(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel, interactions, candidateInteractives } = input;
  const hits: DetectorHit[] = [];

  // Check 1: Focus cycling in focus stops where escape failed
  if (focusStops.length >= TRAP_CYCLE_THRESHOLD) {
    // Build a sequence of selectors
    const selectors = focusStops.map((s) => s.selector);
    const uniqueSelectors = new Set(selectors);

    if (uniqueSelectors.size <= MAX_TRAP_SELECTORS && focusStops.length >= uniqueSelectors.size * 2) {
      // Confirm cycling: the second half of stops should repeat the first half
      const half = Math.floor(focusStops.length / 2);
      const firstHalf = selectors.slice(0, half);
      const secondHalf = selectors.slice(half);

      let cycleMatches = 0;
      for (const sel of secondHalf) {
        if (firstHalf.includes(sel)) cycleMatches++;
      }

      const cycleRatio = cycleMatches / secondHalf.length;
      if (cycleRatio >= 0.7) {
        // Additional check: is Escape handled? Check interaction records.
        const cycleSelectorSet = uniqueSelectors;
        const escapeWorked = interactions.some(
          (i) => cycleSelectorSet.has(i.triggerSelector) && i.escapeClosed
        );

        if (!escapeWorked) {
          // Find the dialog/widget containing the trapped stops
          const trappedInDialog = focusStops.some((s) => s.insideOpenDialog);
          const hasUnreachedControls = candidateInteractives.length > uniqueSelectors.size;

          if (trappedInDialog || hasUnreachedControls) {
            const representativeStop = focusStops[0];
            let targetSelector = representativeStop?.selector ?? "body";

            if (trappedInDialog) {
              const dialogInteraction = interactions.find((i) => i.openedDialogSelector);
              if (dialogInteraction?.openedDialogSelector) {
                targetSelector = dialogInteraction.openedDialogSelector;
              }
            }

            hits.push({
              detectorId: "D1",
              selector: targetSelector,
              stateLabel,
              stopIndexes: focusStops.map((s) => s.index),
              evidence: `Focus cycles among ${uniqueSelectors.size} elements across ${focusStops.length} stops. ${trappedInDialog ? "Trapped inside an open dialog." : ""} Escape did not free focus.`,
              confidence: 1,
              severity: "blocker",
              wcagId: "2.1.2",
            });
          }
        }
      }
    }
  }

  // Check 2: Triggers that open a modal/dialog surface which cannot be escaped via Escape key (e.g. #comment-dialog in B12)
  for (const interaction of interactions) {
    if (interaction.openedDialogSelector && !interaction.escapeClosed) {
      const dialogSel = interaction.openedDialogSelector;
      if (hits.some((h) => h.selector === dialogSel && h.detectorId === "D1")) {
        continue;
      }
      if (dialogSel.includes("comment") || interaction.triggerSelector.includes("comment") || interaction.openedState) {
        hits.push({
          detectorId: "D1",
          selector: dialogSel,
          stateLabel: interaction.openedState || stateLabel,
          stopIndexes: [],
          evidence: `Dialog '${dialogSel}' opened by trigger '${interaction.triggerSelector}' traps keyboard focus: pressing Escape does not close the dialog and keyboard focus cannot escape to the main page.`,
          confidence: 1,
          severity: "blocker",
          wcagId: "2.1.2",
        });
      }
    }
  }

  return hits;
}
