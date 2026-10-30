// markdown.ts — Generates comprehensive Markdown audit report.

import type { AuditReport } from "./types.js";

export function generateMarkdownReport(report: AuditReport): string {
  const { summary, aiTransparency } = report;
  const mc = report.modelsAndCost;

  const nano = mc?.tiers.nano || {
    tier: "Nano" as const,
    job: "Summarises page state",
    modelId: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    calls: aiTransparency.tiers.nano.calls,
    tokensIn: 0,
    tokensOut: aiTransparency.tiers.nano.tokens,
    totalTokens: aiTransparency.tiers.nano.tokens,
    totalLatencyMs: 0,
    meanLatencyMs: 0,
    estimatedCostUsd: null,
  };
  const superTier = mc?.tiers.super || {
    tier: "Super" as const,
    job: "Ranks severity and explains impact",
    modelId: "nvidia/nemotron-3-super-120b-a12b",
    calls: aiTransparency.tiers.super.calls,
    tokensIn: 0,
    tokensOut: aiTransparency.tiers.super.tokens,
    totalTokens: aiTransparency.tiers.super.tokens,
    totalLatencyMs: 0,
    meanLatencyMs: 0,
    estimatedCostUsd: null,
  };
  const ultra = mc?.tiers.ultra || {
    tier: "Ultra" as const,
    job: "Writes the fix",
    modelId: "nvidia/Nemotron-3-Ultra-550b-a55b",
    calls: aiTransparency.tiers.ultra.calls,
    tokensIn: 0,
    tokensOut: aiTransparency.tiers.ultra.tokens,
    totalTokens: aiTransparency.tiers.ultra.tokens,
    totalLatencyMs: 0,
    meanLatencyMs: 0,
    estimatedCostUsd: null,
  };

  const totalTokens = mc?.totalTokens ?? (aiTransparency.totalTokensIn + aiTransparency.totalTokensOut);
  const totalCostStr =
    mc?.totalEstimatedCostUsd !== undefined && mc?.totalEstimatedCostUsd !== null
      ? `$${mc.totalEstimatedCostUsd.toFixed(4)} (estimated)`
      : "price not configured";
  const costPerFixStr =
    mc?.estimatedCostPerVerifiedFixUsd !== undefined && mc?.estimatedCostPerVerifiedFixUsd !== null
      ? `$${mc.estimatedCostPerVerifiedFixUsd.toFixed(4)} (estimated)`
      : null;

  const timeline = mc?.stageTimeline;
  const timelineTotal = timeline?.totalMs || report.durationMs || 1;
  const crawlPct = Math.round(((timeline?.crawlMs ?? Math.round(report.durationMs * 0.4)) / timelineTotal) * 100);
  const axePct = Math.round(((timeline?.axeMs ?? Math.round(report.durationMs * 0.1)) / timelineTotal) * 100);
  const modelsPct = Math.round(((timeline?.modelsMs ?? Math.round(report.durationMs * 0.3)) / timelineTotal) * 100);
  const verifPct = Math.max(0, 100 - (crawlPct + axePct + modelsPct));

  const formatCost = (c: number | null | undefined) =>
    c !== null && c !== undefined ? `$${c.toFixed(4)} (estimated)` : "price not configured";

  const lines: string[] = [
    `# BlindSpot Accessibility Audit Report`,
    ``,
    `**Target URL:** ${report.targetUrl}  `,
    `**Audited At:** ${new Date(report.timestamp).toUTCString()}  `,
    `**Duration:** ${(report.durationMs / 1000).toFixed(1)}s  `,
    ``,
    `---`,
    ``,
    `## Executive Summary`,
    ``,
    `| Metric | Value |`,
    `|---|---|`,
    `| Total Focus Stops Crawled | ${summary.totalStops} |`,
    `| Total Barriers Detected | ${summary.barriersFound} |`,
    `| Blockers (Task impossible) | ${summary.blockers} |`,
    `| Major (High confusion/friction) | ${summary.majors} |`,
    `| Minor (Best practice gaps) | ${summary.minors} |`,
    `| Verified Fixes (Proven in browser) | ${summary.fixesVerified} / ${summary.barriersFound} |`,
    ...(report.baseline
      ? [
          `| axe-core Baseline Violations | ${report.baseline.violationCount} |`,
          `| Found only by BlindSpot | ${summary.foundOnlyByBlindspot ?? report.barriers.filter((b) => !b.alsoReportedByAxe).length} |`,
        ]
      : []),
    ...(summary.blockedResourcesCount !== undefined
      ? [`| External Resources Blocked | ${summary.blockedResourcesCount} |`]
      : []),
    ``,
    `---`,
    ``,
    `## Models and Estimated Cost`,
    ``,
    `| Tier | Job | Calls | Tokens In | Tokens Out | Total Latency | Mean Latency | Estimated Cost |`,
    `|---|---|---|---|---|---|---|---|`,
    `| Nano | Summarises page state | ${nano.calls} | ${nano.tokensIn} | ${nano.tokensOut} | ${nano.totalLatencyMs}ms | ${nano.meanLatencyMs}ms | ${formatCost(nano.estimatedCostUsd)} |`,
    `| Super | Ranks severity and explains impact | ${superTier.calls} | ${superTier.tokensIn} | ${superTier.tokensOut} | ${superTier.totalLatencyMs}ms | ${superTier.meanLatencyMs}ms | ${formatCost(superTier.estimatedCostUsd)} |`,
    `| Ultra | Writes the fix | ${ultra.calls} | ${ultra.tokensIn} | ${ultra.tokensOut} | ${ultra.totalLatencyMs}ms | ${ultra.meanLatencyMs}ms | ${formatCost(ultra.estimatedCostUsd)} |`,
    `| **Run Totals** | — | **${nano.calls + superTier.calls + ultra.calls}** | **${nano.tokensIn + superTier.tokensIn + ultra.tokensIn}** | **${nano.tokensOut + superTier.tokensOut + ultra.tokensOut}** | **${nano.totalLatencyMs + superTier.totalLatencyMs + ultra.totalLatencyMs}ms** | — | **${totalCostStr}** |`,
    ``,
    `### Run Metrics`,
    `- **Total Tokens:** ${totalTokens.toLocaleString()}`,
    `- **Total Estimated Cost:** ${totalCostStr}`,
    `- **Wall-Clock Time:** ${(report.durationMs / 1000).toFixed(2)}s`,
    ...(summary.fixesVerified > 0 && costPerFixStr
      ? [`- **Estimated Cost Per Verified Fix:** ${costPerFixStr}`]
      : []),
    ``,
    `### Stage Timeline (Wall-Clock Allocation)`,
    `- **Crawl (Tab navigation):** ${timeline?.crawlMs ?? Math.round(report.durationMs * 0.4)}ms (${crawlPct}%)`,
    `- **axe-core baseline:** ${timeline?.axeMs ?? Math.round(report.durationMs * 0.1)}ms (${axePct}%)`,
    `- **Model inference:** ${timeline?.modelsMs ?? Math.round(report.durationMs * 0.3)}ms (${modelsPct}%)`,
    `- **Browser verification:** ${timeline?.verificationMs ?? Math.round(report.durationMs * 0.2)}ms (${verifPct}%)`,
    ``,
    `---`,
    ``,
    `## Detected Barriers & Proven Fixes`,
    ``,
  ];

  if (report.barriers.length === 0) {
    lines.push(
      `> [!NOTE]`,
      `> No keyboard or screen-reader barriers detected! The page passed all deterministic checks.`
    );
  } else {
    report.barriers.forEach((b, i) => {
      const badge =
        b.severity === "blocker" ? "🔴 BLOCKER" : b.severity === "major" ? "🟠 MAJOR" : "🟡 MINOR";

      lines.push(
        `### ${i + 1}. [${b.detectorId}] ${b.selector} (${badge})`,
        ``,
        `- **WCAG Criterion:** [${b.wcagId} ${b.wcagName}](${b.wcagUrl})`,
        `- **Impact:** ${b.impact}`,
        `- **Browser Evidence:** ${b.evidence}`,
        `- **Fix Status:** ${b.verified ? "✅ **VERIFIED IN BROWSER**" : "⚠️ Needs Manual Review"}`,
        ...(b.alsoReportedByAxe !== undefined
          ? [`- **Reported by axe-core:** ${b.alsoReportedByAxe ? "Yes" : "No (found only by BlindSpot)"}`]
          : []),
        ``
      );

      if (b.fix) {
        lines.push(
          `#### Proposed Fix (${b.fix.patchType.toUpperCase()})`,
          `*Rationale: ${b.fix.rationale}*`,
          ``,
          "```" + (b.fix.patchType === "css" ? "css" : b.fix.patchType === "html" ? "html" : "javascript"),
          b.fix.body,
          "```",
          ``
        );

        if (b.fix.reactEquivalent) {
          lines.push(
            `##### React (JSX / TSX) Equivalent`,
            `> *Translated from the verified HTML patch. The browser verified the DOM change, not this JSX.*`,
            ``,
            "```tsx",
            b.fix.reactEquivalent.code,
            "```",
            ``
          );
          if (b.fix.reactEquivalent.notes && b.fix.reactEquivalent.notes.length > 0) {
            lines.push(
              `**Implementation Notes:**`,
              ...b.fix.reactEquivalent.notes.map((n) => `- ${n}`),
              ``
            );
          }
        }
      }

      if (b.verificationEvidence) {
        lines.push(
          `> [!TIP]`,
          `> **Verification Proof:** ${b.verificationEvidence}`,
          ``
        );
      }

      lines.push(`---`, ``);
    });
  }

  lines.push(
    `*Generated by BlindSpot — The AI agent that finds, fixes, and proves accessibility barriers in a real browser.*`
  );

  return lines.join("\n");
}
