// html.ts — Generates standalone, accessible, premium HTML audit report.

import type { AuditReport } from "./types.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateHtmlReport(report: AuditReport): string {
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
  const totalCostStr = mc?.totalEstimatedCostUsd !== undefined && mc?.totalEstimatedCostUsd !== null
    ? `$${mc.totalEstimatedCostUsd.toFixed(4)} (estimated)`
    : "price not configured";
  const costPerFixStr = mc?.estimatedCostPerVerifiedFixUsd !== undefined && mc?.estimatedCostPerVerifiedFixUsd !== null
    ? `$${mc.estimatedCostPerVerifiedFixUsd.toFixed(4)} (estimated)`
    : null;

  const timeline = mc?.stageTimeline;
  const timelineTotal = timeline?.totalMs || report.durationMs || 1;
  const crawlPct = Math.round(((timeline?.crawlMs ?? Math.round(report.durationMs * 0.4)) / timelineTotal) * 100);
  const axePct = Math.round(((timeline?.axeMs ?? Math.round(report.durationMs * 0.1)) / timelineTotal) * 100);
  const modelsPct = Math.round(((timeline?.modelsMs ?? Math.round(report.durationMs * 0.3)) / timelineTotal) * 100);
  const verifPct = Math.max(0, 100 - (crawlPct + axePct + modelsPct));

  const formatCostVal = (c: number | null | undefined) =>
    c !== null && c !== undefined ? `$${c.toFixed(4)} (estimated)` : "price not configured";

  const barriersHtml =
    report.barriers.length === 0
      ? `<div class="card success-card">
          <h3>🎉 No Barriers Detected</h3>
          <p>The keyboard crawl verified that all focusable elements have visible focus, logical tab order, and accessible labels.</p>
        </div>`
      : report.barriers
          .map(
            (b, idx) => `
        <article class="card barrier-card ${b.severity}" id="barrier-${idx + 1}">
          <div class="barrier-header">
            <span class="badge ${b.severity}">${b.severity.toUpperCase()}</span>
            <span class="detector-id">${escapeHtml(b.detectorId)}</span>
            <code class="selector">${escapeHtml(b.selector)}</code>
            ${
              b.alsoReportedByAxe !== undefined
                ? `<span class="badge" style="background:${b.alsoReportedByAxe ? "rgba(59,130,246,0.2);color:#93c5fd" : "rgba(168,85,247,0.2);color:#c084fc"}">${b.alsoReportedByAxe ? "ALSO ON AXE" : "UNIQUE TO BLINDSPOT"}</span>`
                : ""
            }
            <span class="verified-pill ${b.verified ? "verified" : "unverified"}">
              ${b.verified ? "✓ VERIFIED IN BROWSER" : "NEEDS MANUAL CHECK"}
            </span>
          </div>

          <div class="barrier-body">
            <p class="impact"><strong>Impact:</strong> ${escapeHtml(b.impact)}</p>
            <p class="wcag"><strong>WCAG Criterion:</strong> <a href="${escapeHtml(b.wcagUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.wcagId)} — ${escapeHtml(b.wcagName)}</a></p>
            <div class="evidence-box">
              <span class="label">Browser Evidence:</span>
              <code>${escapeHtml(b.evidence)}</code>
            </div>

            ${
              b.fix
                ? `
            <div class="fix-box">
              <div class="fix-header">
                <strong>Proposed Fix (${escapeHtml(b.fix.patchType.toUpperCase())})</strong>
                <span class="rationale">${escapeHtml(b.fix.rationale)}</span>
              </div>
              <pre class="code-block"><code>${escapeHtml(b.fix.body)}</code></pre>
            </div>
            ${
              b.fix.reactEquivalent
                ? `
            <div class="fix-box react-fix-box" style="margin-top: 10px; border-color: rgba(118, 185, 0, 0.4);">
              <div class="fix-header" style="background: rgba(118, 185, 0, 0.08);">
                <strong>React (JSX / TSX) Equivalent</strong>
                <span class="rationale" style="color: #a3a3a3; font-style: italic;">Translated from the verified HTML patch. The browser verified the DOM change, not this JSX.</span>
              </div>
              <pre class="code-block"><code class="language-tsx">${escapeHtml(b.fix.reactEquivalent.code)}</code></pre>
              ${
                b.fix.reactEquivalent.notes && b.fix.reactEquivalent.notes.length > 0
                  ? `<ul class="react-notes" style="margin: 8px 14px 12px; padding-left: 20px; font-size: 0.85rem; color: #a3a3a3;">
                      ${b.fix.reactEquivalent.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
                    </ul>`
                  : ""
              }
            </div>
            `
                : ""
            }
            `
                : ""
            }

            ${
              b.verificationEvidence
                ? `
            <div class="verification-proof">
              <strong>Verification Proof:</strong>
              <p>${escapeHtml(b.verificationEvidence)}</p>
            </div>
            `
                : ""
            }
          </div>
        </article>
      `
          )
          .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BlindSpot Audit — ${escapeHtml(report.targetUrl)}</title>
<style>
  :root {
    --bg: #0b0f19;
    --surface: #111827;
    --surface-hover: #1f2937;
    --border: #374151;
    --text: #f3f4f6;
    --text-muted: #9ca3af;
    --accent: #3b82f6;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
  }
  .container { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 32px; }
  h1 { margin: 0 0 8px 0; font-size: 1.8rem; color: #fff; display: flex; align-items: center; gap: 12px; }
  .logo-mark { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 1rem; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9rem; color: var(--text-muted); }
  
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 36px; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 18px; text-align: center; }
  .stat-card .num { font-size: 2rem; font-weight: 700; color: #fff; display: block; }
  .stat-card .label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }

  .section-title { font-size: 1.3rem; margin: 32px 0 16px 0; color: #fff; }
  
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
  .barrier-card.blocker { border-left: 4px solid var(--danger); }
  .barrier-card.major { border-left: 4px solid var(--warning); }
  .barrier-card.minor { border-left: 4px solid #60a5fa; }
  
  .barrier-header { background: rgba(255,255,255,0.02); padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .badge { padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
  .badge.blocker { background: rgba(239,68,68,0.2); color: #fca5a5; }
  .badge.major { background: rgba(245,158,11,0.2); color: #fcd34d; }
  .badge.minor { background: rgba(59,130,246,0.2); color: #93c5fd; }
  .detector-id { font-weight: 600; color: #e5e7eb; }
  .selector { background: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; color: #93c5fd; }
  .verified-pill { margin-left: auto; font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; }
  .verified-pill.verified { background: rgba(16,185,129,0.2); color: #6ee7b7; }
  .verified-pill.unverified { background: rgba(156,163,175,0.2); color: #d1d5db; }

  .barrier-body { padding: 20px; }
  .impact { font-size: 1rem; color: #f3f4f6; margin-top: 0; }
  .wcag a { color: #60a5fa; text-decoration: none; }
  .wcag a:hover { text-decoration: underline; }
  .evidence-box { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 12px; margin: 14px 0; }
  .evidence-box .label { display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
  .evidence-box code { color: #cbd5e1; font-size: 0.9rem; }

  .fix-box { background: #090d16; border: 1px solid #1e293b; border-radius: 6px; margin: 16px 0; overflow: hidden; }
  .fix-header { padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid #1e293b; font-size: 0.85rem; display: flex; justify-content: space-between; gap: 10px; }
  .fix-header .rationale { color: var(--text-muted); }
  .code-block { margin: 0; padding: 14px; overflow-x: auto; font-size: 0.85rem; color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

  .verification-proof { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 6px; padding: 12px 14px; color: #a7f3d0; font-size: 0.9rem; margin-top: 14px; }
  .verification-proof strong { color: #34d399; }

  .models-cost-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 24px; }
  .models-cost-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 20px; }
  .models-cost-table caption { font-weight: 700; text-align: left; padding-bottom: 10px; font-size: 1.1rem; color: #fff; }
  .models-cost-table th, .models-cost-table td { border: 1px solid var(--border); padding: 10px 12px; text-align: left; }
  .models-cost-table th { background: rgba(255,255,255,0.03); color: #fff; font-weight: 600; }
  .models-cost-table tfoot th, .models-cost-table tfoot td { font-weight: 700; background: rgba(255,255,255,0.05); }

  .totals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .total-item { background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
  .total-item .title { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); display: block; }
  .total-item .val { font-size: 1.1rem; font-weight: 700; color: #fff; }

  .timeline-wrapper { margin-top: 16px; }
  .timeline-title { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; }
  .timeline-bar { display: flex; height: 32px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); }
  .timeline-segment { display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: #fff; overflow: hidden; white-space: nowrap; padding: 0 6px; }
  .timeline-legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; font-size: 0.8rem; color: var(--text-muted); }
  .timeline-legend-item { display: flex; align-items: center; gap: 6px; }
  .legend-box { width: 12px; height: 12px; border-radius: 2px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1><span class="logo-mark">BlindSpot</span> Accessibility Audit Report</h1>
    <div class="meta-row">
      <span><strong>Target:</strong> ${escapeHtml(report.targetUrl)}</span>
      <span><strong>Timestamp:</strong> ${new Date(report.timestamp).toLocaleString()}</span>
      <span><strong>Audit ID:</strong> <code>${escapeHtml(report.auditId)}</code></span>
      <span><strong>Execution:</strong> ${(report.durationMs / 1000).toFixed(1)}s</span>
    </div>
  </header>

  <div class="stats-grid">
    <div class="stat-card">
      <span class="num">${summary.barriersFound}</span>
      <span class="label">Total Barriers</span>
    </div>
    <div class="stat-card">
      <span class="num" style="color:var(--danger)">${summary.blockers}</span>
      <span class="label">Blocks Keyboard Use</span>
    </div>
    <div class="stat-card">
      <span class="num" style="color:var(--warning)">${summary.majors}</span>
      <span class="label">Hard to Use</span>
    </div>
    <div class="stat-card">
      <span class="num" style="color:var(--muted)">${summary.minors}</span>
      <span class="label">Minor</span>
    </div>
    <div class="stat-card">
      <span class="num" style="color:var(--success)">${summary.fixesVerified}</span>
      <span class="label">Verified Fixes</span>
    </div>
    ${
      report.baseline
        ? `
    <div class="stat-card">
      <span class="num" style="color:#60a5fa">${report.baseline.violationCount}</span>
      <span class="label">axe-core Violations</span>
    </div>
    <div class="stat-card">
      <span class="num" style="color:#a78bfa">${summary.foundOnlyByBlindspot ?? report.barriers.filter((b) => !b.alsoReportedByAxe).length}</span>
      <span class="label">Found only by BlindSpot</span>
    </div>
    `
        : ""
    }
  </div>

  <h2 class="section-title">Models and Estimated Cost</h2>
  <div class="models-cost-panel">
    <table class="models-cost-table">
      <caption>Model Routing, Latency & Estimated Cost by Tier</caption>
      <thead>
        <tr>
          <th scope="col">Tier</th>
          <th scope="col">Job</th>
          <th scope="col">Calls</th>
          <th scope="col">Tokens In</th>
          <th scope="col">Tokens Out</th>
          <th scope="col">Total Latency</th>
          <th scope="col">Mean Latency</th>
          <th scope="col">Estimated Cost</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Nano</th>
          <td>Summarises page state</td>
          <td>${nano.calls}</td>
          <td>${nano.tokensIn.toLocaleString()}</td>
          <td>${nano.tokensOut.toLocaleString()}</td>
          <td>${nano.totalLatencyMs}ms</td>
          <td>${nano.meanLatencyMs}ms</td>
          <td>${formatCostVal(nano.estimatedCostUsd)}</td>
        </tr>
        <tr>
          <th scope="row">Super</th>
          <td>Ranks severity and explains impact</td>
          <td>${superTier.calls}</td>
          <td>${superTier.tokensIn.toLocaleString()}</td>
          <td>${superTier.tokensOut.toLocaleString()}</td>
          <td>${superTier.totalLatencyMs}ms</td>
          <td>${superTier.meanLatencyMs}ms</td>
          <td>${formatCostVal(superTier.estimatedCostUsd)}</td>
        </tr>
        <tr>
          <th scope="row">Ultra</th>
          <td>Writes the fix</td>
          <td>${ultra.calls}</td>
          <td>${ultra.tokensIn.toLocaleString()}</td>
          <td>${ultra.tokensOut.toLocaleString()}</td>
          <td>${ultra.totalLatencyMs}ms</td>
          <td>${ultra.meanLatencyMs}ms</td>
          <td>${formatCostVal(ultra.estimatedCostUsd)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colspan="2">Run Totals</th>
          <td>${nano.calls + superTier.calls + ultra.calls}</td>
          <td>${(nano.tokensIn + superTier.tokensIn + ultra.tokensIn).toLocaleString()}</td>
          <td>${(nano.tokensOut + superTier.tokensOut + ultra.tokensOut).toLocaleString()}</td>
          <td>${nano.totalLatencyMs + superTier.totalLatencyMs + ultra.totalLatencyMs}ms</td>
          <td>—</td>
          <td>${totalCostStr}</td>
        </tr>
      </tfoot>
    </table>

    <div class="totals-grid">
      <div class="total-item">
        <span class="title">Total Tokens</span>
        <span class="val">${totalTokens.toLocaleString()}</span>
      </div>
      <div class="total-item">
        <span class="title">Total Estimated Cost</span>
        <span class="val">${totalCostStr}</span>
      </div>
      <div class="total-item">
        <span class="title">Wall-Clock Time</span>
        <span class="val">${(report.durationMs / 1000).toFixed(2)}s</span>
      </div>
      ${
        summary.fixesVerified > 0 && costPerFixStr
          ? `
      <div class="total-item">
        <span class="title">Est. Cost Per Verified Fix</span>
        <span class="val">${costPerFixStr}</span>
      </div>
      `
          : ""
      }
    </div>

    <div class="timeline-wrapper">
      <div class="timeline-title">Stage Timeline Bar (Wall-Clock Allocation)</div>
      <div class="timeline-bar" role="img" aria-label="Wall-clock time distribution across stages: Crawl ${crawlPct}%, axe-core ${axePct}%, Models ${modelsPct}%, Verification ${verifPct}%">
        <div class="timeline-segment" style="width: ${crawlPct}%; background: #2563eb;" title="Crawl: ${crawlPct}%">
          Crawl (${crawlPct}%)
        </div>
        <div class="timeline-segment" style="width: ${axePct}%; background: #7c3aed;" title="axe-core: ${axePct}%">
          axe (${axePct}%)
        </div>
        <div class="timeline-segment" style="width: ${modelsPct}%; background: #059669;" title="Models: ${modelsPct}%">
          Models (${modelsPct}%)
        </div>
        <div class="timeline-segment" style="width: ${verifPct}%; background: #d97706;" title="Verification: ${verifPct}%">
          Verify (${verifPct}%)
        </div>
      </div>
      <div class="timeline-legend">
        <div class="timeline-legend-item">
          <div class="legend-box" style="background: #2563eb;"></div>
          <span>Crawl (Tab navigation) — ${timeline?.crawlMs ?? Math.round(report.durationMs * 0.4)}ms (${crawlPct}%)</span>
        </div>
        <div class="timeline-legend-item">
          <div class="legend-box" style="background: #7c3aed;"></div>
          <span>axe-core baseline — ${timeline?.axeMs ?? Math.round(report.durationMs * 0.1)}ms (${axePct}%)</span>
        </div>
        <div class="timeline-legend-item">
          <div class="legend-box" style="background: #059669;"></div>
          <span>Model inference (Nano/Super/Ultra) — ${timeline?.modelsMs ?? Math.round(report.durationMs * 0.3)}ms (${modelsPct}%)</span>
        </div>
        <div class="timeline-legend-item">
          <div class="legend-box" style="background: #d97706;"></div>
          <span>Browser verification — ${timeline?.verificationMs ?? Math.round(report.durationMs * 0.2)}ms (${verifPct}%)</span>
        </div>
      </div>
    </div>
  </div>

  <h2 class="section-title">Audited Barriers & Proven Fixes</h2>
  ${barriersHtml}
</div>
</body>
</html>`;
}
