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

  const scoreColor =
    report.keyboardScore >= 90
      ? "#10b981"
      : report.keyboardScore >= 70
        ? "#f59e0b"
        : "#ef4444";

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
  .score-card .num { color: ${scoreColor}; }

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

  .ledger-box { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; font-size: 0.9rem; color: var(--text-muted); }
  .ledger-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px; }
  .ledger-item { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px; }
  .ledger-item strong { display: block; color: #fff; font-size: 1.1rem; }
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
    <div class="stat-card score-card">
      <span class="num">${report.keyboardScore}</span>
      <span class="label">Keyboard Score</span>
    </div>
    <div class="stat-card">
      <span class="num">${summary.barriersFound}</span>
      <span class="label">Barriers Found</span>
    </div>
    <div class="stat-card">
      <span class="num" style="color:var(--danger)">${summary.blockers}</span>
      <span class="label">Blockers</span>
    </div>
    <div class="stat-card">
      <span class="num" style="color:var(--success)">${summary.fixesVerified}</span>
      <span class="label">Verified Fixes</span>
    </div>
  </div>

  <h2 class="section-title">Audited Barriers & Proven Fixes</h2>
  ${barriersHtml}

  <h2 class="section-title">AI Transparency Ledger (Nebius Token Factory & Tavily)</h2>
  <div class="ledger-box">
    <p>Every model call made during this audit is recorded with exact token usage, latency, and purpose:</p>
    <div class="ledger-grid">
      <div class="ledger-item">
        <strong>${aiTransparency.tiers.nano.calls} Calls</strong>
        <span>Nemotron Nano (Digests) — ${aiTransparency.tiers.nano.tokens} tokens</span>
      </div>
      <div class="ledger-item">
        <strong>${aiTransparency.tiers.super.calls} Calls</strong>
        <span>Nemotron Super (Analysis) — ${aiTransparency.tiers.super.tokens} tokens</span>
      </div>
      <div class="ledger-item">
        <strong>${aiTransparency.tiers.ultra.calls} Calls</strong>
        <span>Nemotron Ultra (Fixes) — ${aiTransparency.tiers.ultra.tokens} tokens</span>
      </div>
      <div class="ledger-item">
        <strong>${(aiTransparency.totalLatencyMs / 1000).toFixed(2)}s</strong>
        <span>Total Model Latency (${aiTransparency.totalTokensIn + aiTransparency.totalTokensOut} tokens)</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}
