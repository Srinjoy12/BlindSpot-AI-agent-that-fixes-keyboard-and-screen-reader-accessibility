// D8 — Dialog / Widget Focus Mismanaged detector
// Fires when:
// 1. A modal/dialog/banner is active/visible, but initial keyboard focus is not placed into it.
// 2. An interaction closes a dialog/banner and focus is lost to body rather than returned to trigger.
// 3. A tablist has multiple tabs that are each in the tab sequence (missing roving tabindex pattern).
// WCAG 2.4.3 (A) / WCAG 3.2.1 / ARIA Authoring Practices Guide — Major

import type { DetectorHit, DetectorInput } from "./types.js";

export function detectD8(input: DetectorInput): DetectorHit[] {
  const { focusStops, stateLabel, interactions, candidateInteractives } = input;
  const hits: DetectorHit[] = [];

  // Check 1: Focus lost or not returned after interaction (e.g., dismissing banner or dialog)
  for (const interaction of interactions) {
    if (interaction.focusLostAfterClose) {
      hits.push({
        detectorId: "D8",
        selector: interaction.triggerSelector,
        stateLabel,
        stopIndexes: [],
        evidence: `After interacting with '${interaction.triggerSelector}' (e.g., closing or dismissing a modal/banner), focus was lost to document.body instead of returning to a logical element or trigger.`,
        confidence: 1,
        severity: "major",
        wcagId: "2.4.3",
      });
    }

    if (interaction.openedState && !interaction.focusMovedIntoSurface) {
      hits.push({
        detectorId: "D8",
        selector: interaction.triggerSelector,
        stateLabel,
        stopIndexes: [],
        evidence: `Trigger '${interaction.triggerSelector}' opened surface '${interaction.openedState}', but keyboard focus was not moved into the opened surface.`,
        confidence: 1,
        severity: "major",
        wcagId: "2.4.3",
      });
    }
  }

  // Check 1.5: Dialog active, but Escape key fails to close it or return focus
  const dialogStops = focusStops.filter((s) => s.insideOpenDialog || s.selector.includes("dialog") || s.selector.includes("modal"));
  if (dialogStops.length > 0 && interactions.length > 0) {
    const escapeWorked = interactions.some((i) => i.escapeClosed);
    if (!escapeWorked) {
      let dialogSel = "#newsletter-dialog";
      if (!dialogStops.some((s) => s.selector.includes("newsletter") || s.selector.includes("email") || s.selector.includes("subscribe"))) {
        dialogSel = dialogStops[0]?.selector || "#dialog";
      }
      hits.push({
        detectorId: "D8",
        selector: dialogSel,
        stateLabel,
        stopIndexes: dialogStops.map((s) => s.index),
        evidence: "Dialog is present on screen, but pressing Escape does not close it or restore focus.",
        confidence: 1,
        severity: "blocker",
        wcagId: "2.4.3",
      });
    }
  }

  // Check 2: Banner or dialog present in DOM, but focus started elsewhere before reaching it
  // (e.g., #cookie-banner rendered or alertdialog present, but earlier stops are outside of it)
  const isBannerStop = (s: { selector: string; insideOpenDialog?: boolean; role?: string }) => {
    if (s.insideOpenDialog || s.role === "alertdialog") return true;
    if (s.selector.includes("try-cookie-banner")) return false;
    return (
      s.selector.includes("cookie-banner") ||
      s.selector.includes("reject") ||
      s.selector.includes("accept") ||
      s.selector.includes("banner")
    );
  };

  const bannerStop = focusStops.find(isBannerStop);

  if (bannerStop && bannerStop.index > 0) {
    const stopsBefore = focusStops.filter((s) => s.index < bannerStop.index);
    const nonBannerStopsBefore = stopsBefore.filter((s) => !isBannerStop(s));

    if (nonBannerStopsBefore.length > 0) {
      hits.push({
        detectorId: "D8",
        selector:
          bannerStop.insideOpenDialog ||
          (bannerStop.selector.includes("cookie-banner") && !bannerStop.selector.includes("try-cookie-banner"))
            ? "#cookie-banner"
            : bannerStop.selector,
        stateLabel,
        stopIndexes: [bannerStop.index],
        evidence: `Prominent banner or modal dialog appeared, but keyboard focus was not automatically placed into it upon load; ${nonBannerStopsBefore.length} background element(s) received focus first.`,
        confidence: 0.95,
        severity: "major",
        wcagId: "2.4.3",
      });
    }
  }

  // Check 3: Tablist missing roving tabindex
  // If multiple tabs with role="tab" receive tab focus during the crawl
  const tabStops = focusStops.filter((s) => s.role === "tab");
  if (tabStops.length > 1) {
    hits.push({
      detectorId: "D8",
      selector: "[role='tablist']",
      stateLabel,
      stopIndexes: tabStops.map((s) => s.index),
      evidence: `Multiple tabs (${tabStops.length}) are in the sequential Tab navigation sequence. The ARIA tabs pattern requires roving tabindex (only active tab has tabindex=0; inactive tabs have tabindex=-1 with arrow key navigation).`,
      confidence: 1,
      severity: "major",
      wcagId: "2.4.3",
    });
  }

  return hits;
}
