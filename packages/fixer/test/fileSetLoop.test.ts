import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  localizeCandidateFiles,
  runFileSetFixLoop,
} from "../src/index.js";
import { closeSharedBrowser, type FileSet } from "@blindspot/engine";
import type { SourceFixRequest, SourceFixResponse } from "@blindspot/ai";

describe("FileSet Localizer & Fix Loop", () => {
  afterAll(async () => {
    await closeSharedBrowser();
  });

  const repoRoot = path.resolve(__dirname, "../../..");
  const fixtureDir = path.resolve(repoRoot, "fixtures/local-project");

  const indexHtml = fs.readFileSync(path.join(fixtureDir, "index.html"), "utf-8");
  const stylesCss = fs.readFileSync(path.join(fixtureDir, "styles.css"), "utf-8");
  const scriptJs = fs.readFileSync(path.join(fixtureDir, "script.js"), "utf-8");

  it("localizes styles.css as the primary candidate for #launch-btn with missing focus indicator (D3)", () => {
    const fileSet: FileSet = new Map([
      ["index.html", indexHtml],
      ["styles.css", stylesCss],
      ["script.js", scriptJs],
    ]);

    const candidates = localizeCandidateFiles(
      {
        selector: "#launch-btn",
        detectorId: "D3",
        evidence: "No outline, box-shadow, border or background change detected when element is focused.",
      },
      fileSet
    );

    expect(candidates.length).toBeGreaterThan(0);
    // styles.css should be candidate #1 because it has the outline reset and button styles
    expect(candidates[0]!.path).toBe("styles.css");
    expect(candidates[0]!.score).toBeGreaterThan(candidates[1]?.score ?? 0);
  });

  it("successfully verifies a fix in styles.css with mocked Ultra fix generator", async () => {
    const fileSet: FileSet = new Map([
      ["index.html", indexHtml],
      ["styles.css", stylesCss],
      ["script.js", scriptJs],
    ]);

    const mockFinding = {
      id: "barrier_1",
      detectorId: "D3" as const,
      selector: "#launch-btn",
      severity: "blocker" as const,
      wcagId: "2.4.7",
      wcagName: "Focus Visible",
      impact: "No visible keyboard focus indicator.",
      stateLabel: "S0",
      confidence: 1,
    };

    const mockGenerator = async (req: SourceFixRequest): Promise<SourceFixResponse> => {
      // Replaces outline: none with high contrast focus indicator
      const fixedCss = req.source.replace(
        "#launch-btn:focus,\n.primary-btn:focus {\n  outline: none;\n}",
        "#launch-btn:focus-visible,\n.primary-btn:focus-visible {\n  outline: 2px solid #0284c7;\n  outline-offset: 2px;\n}"
      );
      return {
        modifiedSource: fixedCss,
        explanation: "Replaced outline suppression with accessible focus-visible outline.",
        changedRegionsHint: [],
      };
    };

    const result = await runFileSetFixLoop({
      fileSet,
      entryPath: "index.html",
      findings: [mockFinding],
      fixGenerator: mockGenerator,
    });

    expect(result.edits.length).toBe(1);
    const edit = result.edits[0]!;
    expect(edit.path).toBe("styles.css");
    expect(edit.status).toBe("verified");
    expect(edit.unifiedDiff).toContain("+  outline: 2px solid #0284c7;");
    expect(edit.attempts).toBe(1);
    expect(result.finalFileSet.get("styles.css")).toContain("outline: 2px solid #0284c7");
  }, 20_000);

  it("rejects an edit proposal if the file path is outside the uploaded FileSet", async () => {
    const fileSet: FileSet = new Map([
      ["index.html", indexHtml],
    ]);

    const mockFinding = {
      id: "barrier_fake",
      detectorId: "D5" as const,
      selector: "#missing-element",
      severity: "major" as const,
      wcagId: "2.4.7",
      wcagName: "Focus Visible",
      impact: "No visible keyboard focus indicator.",
      stateLabel: "S0",
      confidence: 1,
    };

    // Even if localizer returned something outside or invalid
    const result = await runFileSetFixLoop({
      fileSet,
      entryPath: "index.html",
      findings: [mockFinding],
    });

    for (const edit of result.edits) {
      expect(fileSet.has(edit.path)).toBe(true);
    }
  });
});
