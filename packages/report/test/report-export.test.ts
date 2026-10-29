import { describe, it, expect } from "vitest";
import {
  AuditReportSchema,
  generateHtmlReport,
  generateMarkdownReport,
  type AuditReport,
} from "../src/index.js";

describe("Report Exports and Shape Snapshot", () => {
  const sampleReport: AuditReport = {
    auditId: "test_audit_b01",
    targetUrl: "http://localhost:3000/fixtures/B01-keyboard-trap.html",
    timestamp: "2026-10-25T18:19:47.243Z",
    durationMs: 8500,
    keyboardScore: 85,
    summary: {
      totalStops: 6,
      barriersFound: 1,
      blockers: 1,
      majors: 0,
      minors: 0,
      fixesVerified: 1,
      axeViolations: 1,
      foundOnlyByBlindspot: 0,
    },
    barriers: [
      {
        id: "barrier_1",
        detectorId: "D1",
        severity: "blocker",
        selector: "#subscribe-btn",
        wcagId: "2.1.2",
        wcagName: "No Keyboard Trap",
        wcagUrl: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap",
        impact: "Focus cycles among 3 elements inside modal dialog.",
        evidence: "Focus cycles among 3 elements inside modal dialog. Escape did not free focus.",
        fix: {
          patchType: "script",
          targetSelector: "#subscribe-btn",
          body: "document.addEventListener('keydown', e => { if (e.key === 'Escape') dialog.close(); });",
          rationale: "Adds standard Escape listener.",
        },
        verified: true,
        verificationEvidence: "Chromium keyboard re-crawl confirmed barrier eliminated with 0 regressions.",
        alsoReportedByAxe: true,
      },
    ],
    aiTransparency: {
      totalCalls: 3,
      totalTokensIn: 3320,
      totalTokensOut: 1110,
      totalLatencyMs: 6320,
      tiers: {
        nano: { calls: 1, tokens: 630 },
        super: { calls: 1, tokens: 1670 },
        ultra: { calls: 1, tokens: 2130 },
      },
      tavilyQueries: ["WCAG 2.1.2"],
    },
    modelsAndCost: {
      tiers: {
        nano: {
          tier: "Nano",
          job: "Summarises page state",
          modelId: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
          calls: 1,
          tokensIn: 450,
          tokensOut: 180,
          totalTokens: 630,
          totalLatencyMs: 820,
          meanLatencyMs: 820,
          estimatedCostUsd: 0.000176,
        },
        super: {
          tier: "Super",
          job: "Ranks severity and explains impact",
          modelId: "nvidia/nemotron-3-super-120b-a12b",
          calls: 1,
          tokensIn: 1250,
          tokensOut: 420,
          totalTokens: 1670,
          totalLatencyMs: 2100,
          meanLatencyMs: 2100,
          estimatedCostUsd: 0.001506,
        },
        ultra: {
          tier: "Ultra",
          job: "Writes the fix",
          modelId: "nvidia/Nemotron-3-Ultra-550b-a55b",
          calls: 1,
          tokensIn: 1620,
          tokensOut: 510,
          totalTokens: 2130,
          totalLatencyMs: 3400,
          meanLatencyMs: 3400,
          estimatedCostUsd: 0.00378,
        },
      },
      totalCalls: 3,
      totalTokensIn: 3320,
      totalTokensOut: 1110,
      totalTokens: 4430,
      totalLatencyMs: 6320,
      totalEstimatedCostUsd: 0.005462,
      estimatedCostPerVerifiedFixUsd: 0.005462,
      wallClockDurationMs: 8500,
      stageTimeline: {
        crawlMs: 1800,
        axeMs: 550,
        modelsMs: 4200,
        verificationMs: 1950,
        totalMs: 8500,
      },
    },
  };

  it("validates the exported JSON shape matching AuditReportSchema exactly", () => {
    const parseResult = AuditReportSchema.safeParse(sampleReport);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const data = parseResult.data;
      expect(data.modelsAndCost).toBeDefined();
      expect(data.modelsAndCost?.tiers.nano.job).toBe("Summarises page state");
      expect(data.modelsAndCost?.tiers.super.job).toBe("Ranks severity and explains impact");
      expect(data.modelsAndCost?.tiers.ultra.job).toBe("Writes the fix");

      // Verify that per-tier costs add up to total estimated cost
      const sumTierCosts =
        data.modelsAndCost!.tiers.nano.estimatedCostUsd! +
        data.modelsAndCost!.tiers.super.estimatedCostUsd! +
        data.modelsAndCost!.tiers.ultra.estimatedCostUsd!;
      expect(sumTierCosts).toBeCloseTo(data.modelsAndCost!.totalEstimatedCostUsd!, 4);

      // Snapshot shape test
      expect(data).toMatchInlineSnapshot(`
        {
          "aiTransparency": {
            "tavilyQueries": [
              "WCAG 2.1.2",
            ],
            "tiers": {
              "nano": {
                "calls": 1,
                "tokens": 630,
              },
              "super": {
                "calls": 1,
                "tokens": 1670,
              },
              "ultra": {
                "calls": 1,
                "tokens": 2130,
              },
            },
            "totalCalls": 3,
            "totalLatencyMs": 6320,
            "totalTokensIn": 3320,
            "totalTokensOut": 1110,
          },
          "auditId": "test_audit_b01",
          "barriers": [
            {
              "alsoReportedByAxe": true,
              "detectorId": "D1",
              "evidence": "Focus cycles among 3 elements inside modal dialog. Escape did not free focus.",
              "fix": {
                "body": "document.addEventListener('keydown', e => { if (e.key === 'Escape') dialog.close(); });",
                "patchType": "script",
                "rationale": "Adds standard Escape listener.",
                "targetSelector": "#subscribe-btn",
              },
              "id": "barrier_1",
              "impact": "Focus cycles among 3 elements inside modal dialog.",
              "selector": "#subscribe-btn",
              "severity": "blocker",
              "verificationEvidence": "Chromium keyboard re-crawl confirmed barrier eliminated with 0 regressions.",
              "verified": true,
              "wcagId": "2.1.2",
              "wcagName": "No Keyboard Trap",
              "wcagUrl": "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap",
            },
          ],
          "durationMs": 8500,
          "keyboardScore": 85,
          "modelsAndCost": {
            "estimatedCostPerVerifiedFixUsd": 0.005462,
            "stageTimeline": {
              "axeMs": 550,
              "crawlMs": 1800,
              "modelsMs": 4200,
              "totalMs": 8500,
              "verificationMs": 1950,
            },
            "tiers": {
              "nano": {
                "calls": 1,
                "estimatedCostUsd": 0.000176,
                "job": "Summarises page state",
                "meanLatencyMs": 820,
                "modelId": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
                "tier": "Nano",
                "tokensIn": 450,
                "tokensOut": 180,
                "totalLatencyMs": 820,
                "totalTokens": 630,
              },
              "super": {
                "calls": 1,
                "estimatedCostUsd": 0.001506,
                "job": "Ranks severity and explains impact",
                "meanLatencyMs": 2100,
                "modelId": "nvidia/nemotron-3-super-120b-a12b",
                "tier": "Super",
                "tokensIn": 1250,
                "tokensOut": 420,
                "totalLatencyMs": 2100,
                "totalTokens": 1670,
              },
              "ultra": {
                "calls": 1,
                "estimatedCostUsd": 0.00378,
                "job": "Writes the fix",
                "meanLatencyMs": 3400,
                "modelId": "nvidia/Nemotron-3-Ultra-550b-a55b",
                "tier": "Ultra",
                "tokensIn": 1620,
                "tokensOut": 510,
                "totalLatencyMs": 3400,
                "totalTokens": 2130,
              },
            },
            "totalCalls": 3,
            "totalEstimatedCostUsd": 0.005462,
            "totalLatencyMs": 6320,
            "totalTokens": 4430,
            "totalTokensIn": 3320,
            "totalTokensOut": 1110,
            "wallClockDurationMs": 8500,
          },
          "summary": {
            "axeViolations": 1,
            "barriersFound": 1,
            "blockers": 1,
            "fixesVerified": 1,
            "foundOnlyByBlindspot": 0,
            "majors": 0,
            "minors": 0,
            "totalStops": 6,
          },
          "targetUrl": "http://localhost:3000/fixtures/B01-keyboard-trap.html",
          "timestamp": "2026-10-25T18:19:47.243Z",
        }
      `);
    }
  });

  it("generates HTML report containing accessible table and stage timeline with estimated labels", () => {
    const html = generateHtmlReport(sampleReport);
    expect(html).toContain("<caption");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("Summarises page state");
    expect(html).toContain("Ranks severity and explains impact");
    expect(html).toContain("Writes the fix");
    expect(html).toContain("(estimated)");
    expect(html).toContain("Stage Timeline Bar (Wall-Clock Allocation)");
    expect(html).toContain("Crawl");
    expect(html).toContain("axe");
    expect(html).toContain("Models");
    expect(html).toContain("Verify");
    expect(html).toContain("Est. Cost Per Verified Fix");
  });

  it("generates Markdown report containing models & cost table and stage timeline", () => {
    const md = generateMarkdownReport(sampleReport);
    expect(md).toContain("## Models and Estimated Cost");
    expect(md).toContain("| Tier | Job | Calls | Tokens In | Tokens Out | Total Latency | Mean Latency | Estimated Cost |");
    expect(md).toContain("| Nano | Summarises page state |");
    expect(md).toContain("| Super | Ranks severity and explains impact |");
    expect(md).toContain("| Ultra | Writes the fix |");
    expect(md).toContain("(estimated)");
    expect(md).toContain("### Stage Timeline (Wall-Clock Allocation)");
    expect(md).toContain("- **Crawl (Tab navigation):**");
    expect(md).toContain("- **Estimated Cost Per Verified Fix:**");
  });

  it("generates Markdown and HTML reports containing React equivalent when present", () => {
    const reportWithReact: AuditReport = {
      ...sampleReport,
      barriers: [
        {
          ...sampleReport.barriers[0]!,
          fix: {
            ...sampleReport.barriers[0]!.fix!,
            reactEquivalent: {
              code: "useEffect(() => { ... }, []);",
              notes: ["Use window event listener with cleanup"],
              source: "deterministic",
            },
          },
        },
      ],
    };

    const md = generateMarkdownReport(reportWithReact);
    expect(md).toContain("##### React (JSX / TSX) Equivalent");
    expect(md).toContain("Translated from the verified HTML patch. The browser verified the DOM change, not this JSX.");
    expect(md).toContain("useEffect(() => { ... }, []);");
    expect(md).toContain("- Use window event listener with cleanup");

    const html = generateHtmlReport(reportWithReact);
    expect(html).toContain("React (JSX / TSX) Equivalent");
    expect(html).toContain("Translated from the verified HTML patch. The browser verified the DOM change, not this JSX.");
    expect(html).toContain("useEffect");
    expect(html).toContain("Use window event listener with cleanup");
  });
});
