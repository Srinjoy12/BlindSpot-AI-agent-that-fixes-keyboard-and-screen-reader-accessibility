import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FixesInlineView } from "./components/FixesInlineView.js";
import { DiffModal } from "./components/DiffModal.js";
import { SegmentedControl } from "./components/ui/SegmentedControl.js";
import type { BarrierItem } from "./components/BarrierList.js";

describe("React / HTML Toggle in Fix Views", () => {
  const barrierWithFix: BarrierItem = {
    id: "barrier_1",
    detectorId: "D1",
    severity: "blocker",
    selector: "#modal-dialog",
    wcagId: "2.1.2",
    wcagName: "No Keyboard Trap",
    wcagUrl: "https://www.w3.org/WAI/WCAG22/quickref/#2.1.2",
    impact: "Focus trapped inside modal dialog.",
    evidence: "Focus cannot leave modal with Tab or Escape key.",
    verified: true,
    fix: {
      patchType: "script",
      body: "document.addEventListener('keydown', e => { if (e.key === 'Escape') dialog.close(); });",
      rationale: "Adds Escape listener with cleanup",
      targetSelector: "#modal-dialog",
      reactEquivalent: {
        code: "useEffect(() => { const h = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);",
        notes: ["Use useEffect with window event listener cleanup."],
        source: "deterministic",
      },
    },
  };

  const barrierWithoutFix: BarrierItem = {
    id: "barrier_2",
    detectorId: "D3",
    severity: "minor",
    selector: "#footer-link",
    wcagId: "2.4.7",
    wcagName: "Focus Visible",
    wcagUrl: "https://www.w3.org/WAI/WCAG22/quickref/#2.4.7",
    impact: "Focus ring not visible.",
    evidence: "No visible change on focus.",
    verified: false,
    // No fix, no reactEquivalent
  };

  it("FixesInlineView renders SegmentedControl when reactEquivalent exists", () => {
    const html = renderToStaticMarkup(
      <FixesInlineView
        barriers={[barrierWithFix]}
        onOpenFullScreen={() => {}}
      />
    );

    // Segmented control is present
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("HTML / DOM patch");
    expect(html).toContain("React (JSX / TSX)");
    // Live region is present
    expect(html).toContain('aria-live="polite"');
  });

  it("FixesInlineView completely hides SegmentedControl when no reactEquivalent exists", () => {
    const html = renderToStaticMarkup(
      <FixesInlineView
        barriers={[barrierWithoutFix]}
        onOpenFullScreen={() => {}}
      />
    );

    // No fix and no reactEquivalent -> no segmented control
    expect(html).not.toContain("HTML / DOM patch");
    expect(html).not.toContain("React (JSX / TSX)");
  });

  it("DiffModal renders SegmentedControl and aria-live region when reactEquivalent exists", () => {
    const html = renderToStaticMarkup(
      <DiffModal
        barrier={barrierWithFix}
        onClose={() => {}}
      />
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("HTML / DOM patch");
    expect(html).toContain("React (JSX / TSX)");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Target: #modal-dialog");
  });

  it("SegmentedControl maintains accessible roving tabIndex and ARIA attributes", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl<"html" | "react">
        name="test-toggle"
        ariaLabel="Patch format"
        value="html"
        onChange={() => {}}
        options={[
          { value: "html", label: "HTML / DOM patch" },
          { value: "react", label: "React (JSX / TSX)" },
        ]}
      />
    );

    // Radio group role
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Patch format"');

    // Selected option has tabIndex="0" and aria-checked="true"
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-checked="true"');

    // Unselected option has tabIndex="-1" and aria-checked="false"
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-checked="false"');
  });
});
