import { describe, it, expect } from "vitest";
import { translateFixToReact } from "../src/reactTranslate.js";

describe("Deterministic React Translator (translateFixToReact)", () => {
  it("translates tabindex attribute patch to tabIndex={number}", () => {
    const fix0 = { patchType: "attribute", body: 'tabindex="0"' };
    const res0 = translateFixToReact(fix0);
    expect(res0).not.toBeNull();
    expect(res0?.code).toBe("tabIndex={0}");
    expect(res0?.source).toBe("deterministic");

    const fixNeg1 = { patchType: "attribute", body: 'tabindex="-1"' };
    const resNeg1 = translateFixToReact(fixNeg1);
    expect(resNeg1).not.toBeNull();
    expect(resNeg1?.code).toBe("tabIndex={-1}");
  });

  it("translates aria-label attribute patch", () => {
    const fix = { patchType: "attribute", body: 'aria-label="Close dialog"' };
    const res = translateFixToReact(fix);
    expect(res).not.toBeNull();
    expect(res?.code).toBe('aria-label="Close dialog"');
    expect(res?.source).toBe("deterministic");
  });

  it("translates HTML elements with class, for, and tabindex to JSX equivalents", () => {
    const htmlFix = {
      patchType: "html",
      body: '<label for="username-input" class="form-label" tabindex="0">Username</label>',
    };
    const res = translateFixToReact(htmlFix);
    expect(res).not.toBeNull();
    expect(res?.code).toContain('htmlFor="username-input"');
    expect(res?.code).toContain('className="form-label"');
    expect(res?.code).toContain("tabIndex={0}");
  });

  it("translates inline style string to JSX style object", () => {
    const htmlFix = {
      patchType: "html",
      body: '<div style="position: absolute; top: -50px; outline-offset: 2px;">Hidden</div>',
    };
    const res = translateFixToReact(htmlFix);
    expect(res).not.toBeNull();
    expect(res?.code).toContain("style={");
    expect(res?.code).toContain('position: "absolute"');
    expect(res?.code).toContain('top: "-50px"');
    expect(res?.code).toContain('outlineOffset: "2px"');
  });

  it("translates D1 / Escape key listener script to onKeyDown + useEffect cleanup", () => {
    const fix = {
      patchType: "script",
      body: "document.addEventListener('keydown', function(e) { if (e.key === 'Escape') dialog.close(); });",
    };
    const res = translateFixToReact(fix, { detectorId: "D1" });
    expect(res).not.toBeNull();
    expect(res?.code).toContain("useEffect");
    expect(res?.code).toContain("window.addEventListener(\"keydown\", handleKeyDown)");
    expect(res?.code).toContain("window.removeEventListener(\"keydown\", handleKeyDown)");
    expect(res?.code).toContain("onKeyDown");
    expect(res?.notes.some((n) => n.includes("useEffect"))).toBe(true);
  });

  it("translates D8 focus return to useRef + useEffect trigger focus pattern", () => {
    const fix = {
      patchType: "script",
      body: "dialog.addEventListener('close', () => triggerBtn.focus());",
    };
    const res = translateFixToReact(fix, { detectorId: "D8" });
    expect(res).not.toBeNull();
    expect(res?.code).toContain("useRef");
    expect(res?.code).toContain("triggerRef.current?.focus()");
    expect(res?.notes.some((n) => n.includes("useRef"))).toBe(true);
  });

  it("translates D2 div-button to native button and accessible div with keyboard listeners", () => {
    const fix = {
      patchType: "attribute",
      body: 'role="button" tabindex="0"',
    };
    const res = translateFixToReact(fix, { detectorId: "D2" });
    expect(res).not.toBeNull();
    expect(res?.code).toContain('<button');
    expect(res?.code).toContain('role="button"');
    expect(res?.code).toContain("tabIndex={0}");
    expect(res?.code).toContain('e.key === "Enter" || e.key === " "');
  });

  it("translates D9 skip link and target main container with tabIndex={-1}", () => {
    const fix = {
      patchType: "html",
      body: '<a href="#main-content" class="skip-link">Skip to main content</a>',
    };
    const res = translateFixToReact(fix, { detectorId: "D9" });
    expect(res).not.toBeNull();
    expect(res?.code).toContain('className="skip-link"');
    expect(res?.code).toContain('<main id="main-content" tabIndex={-1}');
    expect(res?.notes.some((n) => n.includes("tabIndex={-1}"))).toBe(true);
  });

  it("translates CSS focus indicator patch to focus-visible styling options", () => {
    const fix = {
      patchType: "css",
      body: "#submit-btn:focus-visible { outline: 2px solid #2563eb !important; outline-offset: 2px !important; }",
    };
    const res = translateFixToReact(fix);
    expect(res).not.toBeNull();
    expect(res?.code).toContain(":focus-visible");
    expect(res?.code).toContain("outline: 2px solid #2563eb");
    expect(res?.code).toContain("outline-offset: 2px");
  });

  it("returns null whenever unsure and never guesses", () => {
    // Unrecognized arbitrary JS
    const complexJs = {
      patchType: "script",
      body: "while(true) { eval('alert(1)'); window.location = 'https://example.com'; }",
    };
    expect(translateFixToReact(complexJs)).toBeNull();

    // Empty body
    const emptyFix = { patchType: "html", body: "" };
    expect(translateFixToReact(emptyFix)).toBeNull();

    // Arbitrary unknown CSS without focus indicator
    const unknownCss = {
      patchType: "css",
      body: ".banner { background: red; margin: 10px; }",
    };
    expect(translateFixToReact(unknownCss)).toBeNull();
  });
});
