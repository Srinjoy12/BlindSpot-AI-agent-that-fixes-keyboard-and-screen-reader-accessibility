// test/detectors.test.ts — Unit tests for pure detectors D1–D9
import { describe, it, expect } from "vitest";
import {
  detectD1,
  detectD2,
  detectD3,
  detectD4,
  detectD5,
  detectD6,
  detectD7,
  detectD8,
  detectD9,
  deduplicateHits,
  runDetectors,
} from "../src/index.js";
import type { DetectorInput, FocusStopLite } from "../src/types.js";

const dummyIndicator = {
  hasOutline: true,
  hasBoxShadow: false,
  hasBorderChange: false,
  hasBackgroundChange: false,
};

const invisibleIndicator = {
  hasOutline: false,
  hasBoxShadow: false,
  hasBorderChange: false,
  hasBackgroundChange: false,
};

describe("D1 — Keyboard Trap", () => {
  it("detects cycling between small set of elements when escape fails", () => {
    const stops: FocusStopLite[] = [
      {
        index: 0,
        selector: "#input-1",
        tagName: "input",
        role: "textbox",
        accessibleName: "Input 1",
        box: { x: 10, y: 10, width: 100, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
      {
        index: 1,
        selector: "#btn-close",
        tagName: "button",
        role: "button",
        accessibleName: "Close",
        box: { x: 10, y: 50, width: 60, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
      {
        index: 2,
        selector: "#input-1",
        tagName: "input",
        role: "textbox",
        accessibleName: "Input 1",
        box: { x: 10, y: 10, width: 100, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
      {
        index: 3,
        selector: "#btn-close",
        tagName: "button",
        role: "button",
        accessibleName: "Close",
        box: { x: 10, y: 50, width: 60, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
    ];

    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: stops,
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD1(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D1");
    expect(hits[0]?.severity).toBe("blocker");
    expect(hits[0]?.wcagId).toBe("2.1.2");
  });

  it("does not flag if Escape closed the modal", () => {
    const stops: FocusStopLite[] = [
      {
        index: 0,
        selector: "#input-1",
        tagName: "input",
        role: "textbox",
        accessibleName: "Input 1",
        box: { x: 10, y: 10, width: 100, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
      {
        index: 1,
        selector: "#btn-close",
        tagName: "button",
        role: "button",
        accessibleName: "Close",
        box: { x: 10, y: 50, width: 60, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
      {
        index: 2,
        selector: "#input-1",
        tagName: "input",
        role: "textbox",
        accessibleName: "Input 1",
        box: { x: 10, y: 10, width: 100, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
      {
        index: 3,
        selector: "#btn-close",
        tagName: "button",
        role: "button",
        accessibleName: "Close",
        box: { x: 10, y: 50, width: 60, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: true,
        scrollY: 0,
      },
    ];

    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: stops,
      interactions: [
        {
          triggerSelector: "#input-1",
          escapeClosed: true,
          focusReturnedToTrigger: true,
          focusMovedIntoSurface: true,
          focusLostAfterClose: false,
        },
      ],
      candidateInteractives: [],
    };

    const hits = detectD1(input);
    expect(hits.length).toBe(0);
  });
});

describe("D2 — Unreachable Control", () => {
  it("flags candidates that never receive focus", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [
        {
          index: 0,
          selector: "#btn-header",
          tagName: "button",
          role: "button",
          accessibleName: "Header",
          box: { x: 0, y: 0, width: 50, height: 20 },
          inViewport: true,
          obscuredBy: null,
          focusIndicator: dummyIndicator,
          insideOpenDialog: false,
          scrollY: 0,
        },
      ],
      interactions: [],
      candidateInteractives: ["#btn-header", "#dept-trigger"],
    };

    const hits = detectD2(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.selector).toBe("#dept-trigger");
    expect(hits[0]?.detectorId).toBe("D2");
    expect(hits[0]?.wcagId).toBe("2.1.1");
  });
});

describe("D3 — Focus Not Visible", () => {
  it("flags elements without any focus indicator", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [
        {
          index: 0,
          selector: "#btn-stealth",
          tagName: "button",
          role: "button",
          accessibleName: "Stealth",
          box: { x: 0, y: 0, width: 80, height: 30 },
          inViewport: true,
          obscuredBy: null,
          focusIndicator: invisibleIndicator,
          insideOpenDialog: false,
          scrollY: 0,
        },
      ],
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD3(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D3");
    expect(hits[0]?.severity).toBe("blocker");
    expect(hits[0]?.wcagId).toBe("2.4.7");
  });
});

describe("D4 — Focus Order Mismatch", () => {
  it("flags significant inversions between tab order and visual coordinates", () => {
    const stops: FocusStopLite[] = [
      {
        index: 0,
        selector: "#bottom-right",
        tagName: "button",
        role: "button",
        accessibleName: "BR",
        box: { x: 500, y: 600, width: 80, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: false,
        scrollY: 0,
      },
      {
        index: 1,
        selector: "#bottom-left",
        tagName: "button",
        role: "button",
        accessibleName: "BL",
        box: { x: 50, y: 550, width: 80, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: false,
        scrollY: 0,
      },
      {
        index: 2,
        selector: "#top-right",
        tagName: "button",
        role: "button",
        accessibleName: "TR",
        box: { x: 500, y: 50, width: 80, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: false,
        scrollY: 0,
      },
      {
        index: 3,
        selector: "#top-left",
        tagName: "button",
        role: "button",
        accessibleName: "TL",
        box: { x: 50, y: 50, width: 80, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: false,
        scrollY: 0,
      },
    ];

    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: stops,
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD4(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D4");
    expect(hits[0]?.wcagId).toBe("2.4.3");
  });
});

describe("D5 — Focus Obscured", () => {
  it("flags elements obscured by another selector", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [
        {
          index: 0,
          selector: "#input-hidden-by-header",
          tagName: "input",
          role: "textbox",
          accessibleName: "Name",
          box: { x: 10, y: 10, width: 200, height: 40 },
          inViewport: true,
          obscuredBy: "#sticky-header",
          focusIndicator: dummyIndicator,
          insideOpenDialog: false,
          scrollY: 100,
        },
      ],
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD5(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D5");
    expect(hits[0]?.wcagId).toBe("2.4.11");
    expect(hits[0]?.evidence).toContain("#sticky-header");
  });
});

describe("D6 — Missing Accessible Name", () => {
  it("flags interactive elements with empty accessible name", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [
        {
          index: 0,
          selector: "#icon-only-btn",
          tagName: "button",
          role: "button",
          accessibleName: "",
          box: { x: 10, y: 10, width: 32, height: 32 },
          inViewport: true,
          obscuredBy: null,
          focusIndicator: dummyIndicator,
          insideOpenDialog: false,
          scrollY: 0,
        },
      ],
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD6(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D6");
    expect(hits[0]?.wcagId).toBe("4.1.2");
  });
});

describe("D7 — Positive Tabindex", () => {
  it("flags elements with tabindex > 0", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [
        {
          index: 0,
          selector: "#email",
          tagName: "input",
          role: "textbox",
          accessibleName: "Email",
          box: { x: 10, y: 10, width: 200, height: 30 },
          inViewport: true,
          obscuredBy: null,
          focusIndicator: dummyIndicator,
          insideOpenDialog: false,
          scrollY: 0,
          tabIndex: 1,
        },
      ],
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD7(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D7");
    expect(hits[0]?.selector).toBe("#email");
  });
});

describe("D8 — Dialog & Widget Focus Mismanaged", () => {
  it("flags focus lost after closing modal/banner", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [],
      interactions: [
        {
          triggerSelector: "#btn-accept",
          escapeClosed: false,
          focusReturnedToTrigger: false,
          focusMovedIntoSurface: false,
          focusLostAfterClose: true,
        },
      ],
      candidateInteractives: [],
    };

    const hits = detectD8(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D8");
    expect(hits[0]?.selector).toBe("#btn-accept");
  });

  it("flags tablist without roving tabindex", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [
        {
          index: 0,
          selector: "#tab-1",
          tagName: "button",
          role: "tab",
          accessibleName: "Tab 1",
          box: { x: 10, y: 10, width: 80, height: 30 },
          inViewport: true,
          obscuredBy: null,
          focusIndicator: dummyIndicator,
          insideOpenDialog: false,
          scrollY: 0,
        },
        {
          index: 1,
          selector: "#tab-2",
          tagName: "button",
          role: "tab",
          accessibleName: "Tab 2",
          box: { x: 100, y: 10, width: 80, height: 30 },
          inViewport: true,
          obscuredBy: null,
          focusIndicator: dummyIndicator,
          insideOpenDialog: false,
          scrollY: 0,
        },
      ],
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD8(input);
    expect(hits.some((h) => h.detectorId === "D8" && h.selector === "[role='tablist']")).toBe(true);
  });
});

describe("D9 — Skip Link Missing", () => {
  it("flags navigation with 10+ links without early skip link", () => {
    const navStops: FocusStopLite[] = Array.from({ length: 15 }, (_, i) => ({
      index: i,
      selector: `nav a:nth-of-type(${i + 1})`,
      tagName: "a",
      role: "link",
      accessibleName: `Link ${i + 1}`,
      box: { x: 10, y: 10 + i * 20, width: 100, height: 18 },
      inViewport: true,
      obscuredBy: null,
      focusIndicator: dummyIndicator,
      insideOpenDialog: false,
      scrollY: 0,
    }));

    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: navStops,
      interactions: [],
      candidateInteractives: [],
    };

    const hits = detectD9(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D9");
    expect(hits[0]?.selector).toBe("nav");
  });
});

describe("runDetectors orchestrator", () => {
  it("returns empty array for clean accessible inputs", () => {
    const cleanStops: FocusStopLite[] = [
      {
        index: 0,
        selector: "#skip-to-content",
        tagName: "a",
        role: "link",
        accessibleName: "Skip to main content",
        box: { x: 10, y: 10, width: 120, height: 30 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: false,
        scrollY: 0,
        tabIndex: 0,
      },
      {
        index: 1,
        selector: "#main-heading-btn",
        tagName: "button",
        role: "button",
        accessibleName: "Get Started",
        box: { x: 10, y: 100, width: 120, height: 40 },
        inViewport: true,
        obscuredBy: null,
        focusIndicator: dummyIndicator,
        insideOpenDialog: false,
        scrollY: 0,
        tabIndex: 0,
      },
    ];

    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: cleanStops,
      interactions: [],
      candidateInteractives: ["#skip-to-content", "#main-heading-btn"],
    };

    const hits = runDetectors(input);
    expect(hits.length).toBe(0);
  });
});

describe("deduplicateHits — Hit deduplication & severity ranking", () => {
  it("never lets D8 (Major, 2.4.3) swallow D1 (Blocker, 2.1.2) on the same container", () => {
    const hits = [
      {
        detectorId: "D8" as const,
        selector: "#newsletter-dialog",
        stateLabel: "S0",
        stopIndexes: [],
        evidence: "Focus is not moved into dialog on open",
        confidence: 0.9,
        severity: "major" as const,
        wcagId: "2.4.3",
      },
      {
        detectorId: "D1" as const,
        selector: "#newsletter-dialog",
        stateLabel: "S0",
        stopIndexes: [0, 1, 2],
        evidence: "Focus cycles indefinitely inside modal; Escape key does not dismiss",
        confidence: 0.95,
        severity: "blocker" as const,
        wcagId: "2.1.2",
      },
    ];

    const deduped = deduplicateHits(hits);
    expect(deduped.length).toBe(2);
    expect(deduped.some((h) => h.detectorId === "D1" && h.wcagId === "2.1.2")).toBe(true);
    expect(deduped.some((h) => h.detectorId === "D8" && h.wcagId === "2.4.3")).toBe(true);
    // D1 blocker ranks first
    expect(deduped[0]?.detectorId).toBe("D1");
  });

  it("suppresses redundant lower-severity hit when container and WCAG criterion are identical", () => {
    const hits = [
      {
        detectorId: "D8" as const,
        selector: "#modal",
        stateLabel: "S0",
        stopIndexes: [],
        evidence: "Minor focus issue",
        confidence: 0.7,
        severity: "minor" as const,
        wcagId: "2.4.3",
      },
      {
        detectorId: "D8" as const,
        selector: "#modal",
        stateLabel: "S0",
        stopIndexes: [],
        evidence: "Major focus loss",
        confidence: 0.9,
        severity: "major" as const,
        wcagId: "2.4.3",
      },
    ];

    const deduped = deduplicateHits(hits);
    expect(deduped.length).toBe(1);
    expect(deduped[0]?.severity).toBe("major");
  });
});

describe("D6 — Missing Accessible Name across full AXTree interactive elements", () => {
  it("inspects captured interactive elements from AXTree beyond visited focus stops", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [], // Crawler never reached these buttons due to sequence cap or custom markup
      interactions: [],
      candidateInteractives: [],
      interactiveElements: [
        {
          selector: "#btn-bold",
          tagName: "button",
          role: "button",
          accessibleName: "B",
          hasAriaLabel: false,
        },
        {
          selector: "#btn-italic",
          tagName: "button",
          role: "button",
          accessibleName: "I",
          hasAriaLabel: false,
        },
        {
          selector: "#btn-undo",
          tagName: "button",
          role: "button",
          accessibleName: "↺",
          hasAriaLabel: false,
        },
        {
          selector: "#btn-save",
          tagName: "button",
          role: "button",
          accessibleName: "Save Document",
          hasAriaLabel: true,
        },
      ],
    };

    const hits = detectD6(input);
    expect(hits.length).toBe(3);
    const selectors = hits.map((h) => h.selector);
    expect(selectors).toContain("#btn-bold");
    expect(selectors).toContain("#btn-italic");
    expect(selectors).toContain("#btn-undo");
    expect(selectors).not.toContain("#btn-save");
  });
});

describe("D1 — Keyboard Trap on interactive modal dialogs", () => {
  it("flags modal dialog opened during interaction that cannot be dismissed via Escape", () => {
    const input: DetectorInput = {
      stateLabel: "S0",
      focusStops: [],
      interactions: [
        {
          triggerSelector: "#open-comment-btn",
          openedDialogSelector: "#comment-dialog",
          escapeClosed: false,
          focusReturnedToTrigger: false,
          focusMovedIntoSurface: true,
          focusLostAfterClose: false,
        },
      ],
      candidateInteractives: [],
    };

    const hits = detectD1(input);
    expect(hits.length).toBe(1);
    expect(hits[0]?.detectorId).toBe("D1");
    expect(hits[0]?.selector).toBe("#comment-dialog");
    expect(hits[0]?.severity).toBe("blocker");
    expect(hits[0]?.wcagId).toBe("2.1.2");
  });
});

