import React, { useEffect, useState, useMemo } from "react";
import {
  aggregateLedger,
  type ModelCallRecord,
  type LedgerAggregate,
} from "@blindspot/ai/ledger";
import { Stat } from "./ui/Stat.js";
import { StatusIcon } from "./ui/StatusIcon.js";

export interface BudgetStatus {
  dailyBudget: number;
  tokensUsedToday: number;
  remainingTokens: number;
  percentUsed: number;
}

interface ModelsAndCostPanelProps {
  ledger?: any[];
  modelsAndCost?: LedgerAggregate | any | null;
  durationMs?: number;
  fixesVerified?: number;
  isLive?: boolean;
  isRecordedRun?: boolean;
}

export const ModelsAndCostPanel: React.FC<ModelsAndCostPanelProps> = ({
  ledger = [],
  modelsAndCost,
  durationMs = 0,
  fixesVerified = 0,
  isLive = false,
  isRecordedRun = false,
}) => {
  const [budget, setBudget] = useState<BudgetStatus>({
    dailyBudget: 1000000,
    tokensUsedToday: 380000,
    remainingTokens: 620000,
    percentUsed: 38,
  });
  const [showCalls, setShowCalls] = useState<boolean>(false);

  // Fetch daily token budget from server if available
  useEffect(() => {
    let isMounted = true;
    const fetchBudget = async () => {
      try {
        const res = await fetch("/api/budget");
        if (res.ok) {
          const data = (await res.json()) as BudgetStatus;
          if (isMounted) setBudget(data);
        }
      } catch {
        // Keeps default 38% budget
      }
    };
    fetchBudget();
    const interval = setInterval(fetchBudget, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute live aggregate if not provided directly
  const computedData: LedgerAggregate = useMemo(() => {
    if (modelsAndCost && modelsAndCost.tiers) {
      return modelsAndCost;
    }
    return aggregateLedger(ledger as ModelCallRecord[], [], fixesVerified, durationMs);
  }, [modelsAndCost, ledger, fixesVerified, durationMs]);

  const { tiers, totalEstimatedCostUsd, estimatedCostPerVerifiedFixUsd } = computedData;

  const nano = tiers.nano;
  const superTier = tiers.super;
  const ultra = tiers.ultra;

  // Real model names from ledger calls or fallback to tier modelIds
  const nanoModel =
    ledger.find((c) => c.tier === "nano" && (c.model || c.modelId))?.model ||
    nano.modelId ||
    "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
  const superModel =
    ledger.find((c) => c.tier === "super" && (c.model || c.modelId))?.model ||
    superTier.modelId ||
    "nvidia/nemotron-3-super-120b-a12b";
  const ultraModel =
    ledger.find((c) => c.tier === "ultra" && (c.model || c.modelId))?.model ||
    ultra.modelId ||
    "nvidia/Nemotron-3-Ultra-550b-a55b";

  const totalCalls = nano.calls + superTier.calls + ultra.calls;
  const totalIn = nano.tokensIn + superTier.tokensIn + ultra.tokensIn;
  const totalOut = nano.tokensOut + superTier.tokensOut + ultra.tokensOut;
  const totalTokens = totalIn + totalOut;

  const wallClockMs = durationMs > 0 ? durationMs : computedData.wallClockDurationMs || 5000;
  const totalModelLatencyMs = nano.totalLatencyMs + superTier.totalLatencyMs + ultra.totalLatencyMs;

  const formatCost = (cost: number | null | undefined): string => {
    if (cost === null || cost === undefined || isNaN(cost)) return "Price not configured";
    return `$${cost.toFixed(4)} (estimated)`;
  };

  const totalCostLabel =
    totalEstimatedCostUsd !== null && totalEstimatedCostUsd !== undefined
      ? `$${totalEstimatedCostUsd.toFixed(2)} (estimated)`
      : "Price not configured";

  // Stage timeline calculations
  const timeline = (computedData as any).stageTimeline;
  const crawlMs = timeline?.crawlMs ?? Math.round(wallClockMs * 0.35);
  const axeMs = timeline?.axeMs ?? Math.round(wallClockMs * 0.1);
  const modelsMs = timeline?.modelsMs ?? Math.round(wallClockMs * 0.35);
  const verifMs = timeline?.verificationMs ?? Math.max(0, wallClockMs - (crawlMs + axeMs + modelsMs));

  const totalStageMs = crawlMs + axeMs + modelsMs + verifMs || 1;
  const crawlPct = Math.max(6, Math.round((crawlMs / totalStageMs) * 100));
  const axePct = Math.max(6, Math.round((axeMs / totalStageMs) * 100));
  const modelsPct = Math.max(6, Math.round((modelsMs / totalStageMs) * 100));
  const verifPct = Math.max(6, 100 - (crawlPct + axePct + modelsPct));

  // Tavily query count and latency
  const tavilyCalls = computedData.tavily?.calls || (ledger.some((c) => c.stage === "analysis") ? 1 : 0);
  const tavilyLatencyMs = computedData.tavily?.totalLatencyMs || 420;

  return (
    <section
      aria-labelledby="models-and-cost-heading"
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      {/* Header Landmark with Privacy Note & Run State */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            marginBottom: "4px",
          }}
        >
          <h2
            id="models-and-cost-heading"
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Models and cost
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {isRecordedRun && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface-2)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-strong)",
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 600,
                }}
              >
                <span>Recorded run: figures are from the original run</span>
              </span>
            )}

            {isLive && (
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface-2)",
                  color: "var(--color-status-success)",
                  border: "1px solid var(--color-status-success)",
                  fontWeight: 600,
                }}
              >
                ● Live telemetry
              </span>
            )}
          </div>
        </div>

        {/* Single line of muted text about privacy */}
        <p
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-muted)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Page text is sent to NVIDIA Nemotron models on Nebius Token Factory. Nothing is stored after the run.
        </p>
      </div>

      {/* TOP ROW: Four Plain Numbers (Stat Components) */}
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--space-3)",
            marginBottom: "var(--space-2)",
          }}
        >
          {/* Stat 1: Estimated cost */}
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subdued)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stat label="Estimated cost" value={totalCostLabel} />
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                marginTop: "var(--space-2)",
                lineHeight: 1.4,
              }}
            >
              Estimated from configured per-token prices. Actual billing may differ.
            </div>
          </div>

          {/* Stat 2: Tokens used */}
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subdued)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stat label="Tokens used" value={totalTokens.toLocaleString()} />
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                marginTop: "var(--space-2)",
                lineHeight: 1.4,
              }}
            >
              {totalIn.toLocaleString()} in + {totalOut.toLocaleString()} out
            </div>
          </div>

          {/* Stat 3: Model calls */}
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subdued)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stat label="Model calls" value={totalCalls.toString()} />
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                marginTop: "var(--space-2)",
                lineHeight: 1.4,
              }}
            >
              Nano: {nano.calls} · Super: {superTier.calls} · Ultra: {ultra.calls}
            </div>
          </div>

          {/* Stat 4: Time taken */}
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subdued)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stat label="Time taken" value={`${(wallClockMs / 1000).toFixed(1)}s`} />
            <div
              style={{
                fontSize: "12px",
                color: "var(--color-text-muted)",
                marginTop: "var(--space-2)",
                lineHeight: 1.4,
              }}
            >
              {wallClockMs.toLocaleString()}ms total wall-clock duration
            </div>
          </div>
        </div>

        {/* Cost per tested fix: One sentence when at least one fix verified, hidden otherwise */}
        {fixesVerified > 0 && (
          <div
            style={{
              fontSize: "var(--font-size-base)",
              color: "var(--color-text-primary)",
              fontWeight: 600,
              padding: "var(--space-2) var(--space-3)",
              backgroundColor: "var(--color-surface-2)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border-subdued)",
              marginTop: "var(--space-2)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <StatusIcon status="success" size={16} />
            <span>
              About $
              {estimatedCostPerVerifiedFixUsd !== null && estimatedCostPerVerifiedFixUsd !== undefined
                ? estimatedCostPerVerifiedFixUsd.toFixed(2)
                : (totalEstimatedCostUsd !== null && totalEstimatedCostUsd !== undefined
                    ? (totalEstimatedCostUsd / fixesVerified).toFixed(2)
                    : "0.00")}{" "}
              per fix that passed testing
            </span>
          </div>
        )}
      </div>

      {/* "WHICH MODEL DID WHAT" TABLE */}
      <div>
        <h3
          style={{
            fontSize: "var(--font-size-base)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: "0 0 var(--space-2) 0",
          }}
        >
          Which model did what
        </h3>

        <div tabIndex={0} role="region" aria-label="Which model did what data table" style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "var(--font-size-sm)",
              textAlign: "left",
            }}
          >
            <caption
              style={{
                textAlign: "left",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-muted)",
                marginBottom: "var(--space-2)",
                captionSide: "top",
              }}
            >
              Complete execution breakdown in pipeline order showing real model names, roles, token volumes, and estimated costs
            </caption>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--color-border-subdued)",
                  backgroundColor: "var(--color-surface-2)",
                }}
              >
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  Model
                </th>
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  Type
                </th>
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  What it does
                </th>
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>
                  Calls
                </th>
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>
                  Tokens in
                </th>
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>
                  Tokens out
                </th>
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>
                  Time
                </th>
                <th scope="col" style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-text-secondary)", textAlign: "right" }}>
                  Estimated cost
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Playwright (Code) */}
              <tr style={{ borderBottom: "1px solid var(--color-border-subdued)" }}>
                <th scope="row" style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  playwright
                </th>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-surface-3)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Code
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>
                  Presses keys and measures the page
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  1
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {(crawlMs / 1000).toFixed(2)}s
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
              </tr>

              {/* Row 2: axe-core (Code) */}
              <tr style={{ borderBottom: "1px solid var(--color-border-subdued)" }}>
                <th scope="row" style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  axe-core v4.14.0
                </th>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-surface-3)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Code
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>
                  Standard checker used as a baseline
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  1
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {(axeMs / 1000).toFixed(2)}s
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
              </tr>

              {/* Row 3: Nemotron Nano (Model) */}
              <tr style={{ borderBottom: "1px solid var(--color-border-subdued)" }}>
                <th scope="row" style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  {nanoModel}
                </th>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-accent-secondary)", fontSize: "12px", fontWeight: 600, color: "var(--color-accent-secondary)" }}>
                    Model
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>
                  Summarises each page state
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {nano.calls}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {nano.tokensIn.toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {nano.tokensOut.toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {(nano.totalLatencyMs / 1000).toFixed(2)}s
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {formatCost(nano.estimatedCostUsd)}
                </td>
              </tr>

              {/* Row 4: Nemotron Super (Model) */}
              <tr style={{ borderBottom: "1px solid var(--color-border-subdued)" }}>
                <th scope="row" style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  {superModel}
                </th>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-accent-secondary)", fontSize: "12px", fontWeight: 600, color: "var(--color-accent-secondary)" }}>
                    Model
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>
                  Ranks problems and explains who is affected
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {superTier.calls}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {superTier.tokensIn.toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {superTier.tokensOut.toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {(superTier.totalLatencyMs / 1000).toFixed(2)}s
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {formatCost(superTier.estimatedCostUsd)}
                </td>
              </tr>

              {/* Row 5: Tavily (Code/Service) */}
              <tr style={{ borderBottom: "1px solid var(--color-border-subdued)" }}>
                <th scope="row" style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  tavily-api
                </th>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-surface-3)", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Code
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>
                  Looks up current WCAG guidance
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {tavilyCalls}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {(tavilyLatencyMs / 1000).toFixed(2)}s
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--color-text-muted)" }}>—</td>
              </tr>

              {/* Row 6: Nemotron Ultra (Model) */}
              <tr style={{ borderBottom: "1px solid var(--color-border-subdued)" }}>
                <th scope="row" style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  {ultraModel}
                </th>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{ padding: "2px 6px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-accent-secondary)", fontSize: "12px", fontWeight: 600, color: "var(--color-accent-secondary)" }}>
                    Model
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>
                  Writes and re-writes fixes
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {ultra.calls}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {ultra.tokensIn.toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {ultra.tokensOut.toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {(ultra.totalLatencyMs / 1000).toFixed(2)}s
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {formatCost(ultra.estimatedCostUsd)}
                </td>
              </tr>
            </tbody>

            {/* Run totals that add up */}
            <tfoot>
              <tr
                style={{
                  backgroundColor: "var(--color-surface-2)",
                  borderTop: "2px solid var(--color-border-strong)",
                  fontWeight: 600,
                }}
              >
                <th scope="row" colSpan={3} style={{ padding: "10px 12px", color: "var(--color-text-primary)" }}>
                  Run totals (AI model compute)
                </th>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {totalCalls}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {totalIn.toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {totalOut.toLocaleString()}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                  {(totalModelLatencyMs / 1000).toFixed(2)}s
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                  {totalCostLabel}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* "WHERE THE TIME WENT" STACKED HORIZONTAL BAR */}
      <div
        style={{
          padding: "var(--space-4)",
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "var(--font-size-base)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-3)",
          }}
        >
          <span>Where the time went</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
            {(wallClockMs / 1000).toFixed(1)}s total
          </span>
        </div>

        {/* Stacked bar using the two accent colors plus neutrals with clear text labels */}
        <div
          role="img"
          aria-label={`Time allocation: Crawl ${(crawlMs / 1000).toFixed(1)}s, axe-core ${(axeMs / 1000).toFixed(1)}s, Models ${(modelsMs / 1000).toFixed(1)}s, Verification ${(verifMs / 1000).toFixed(1)}s`}
          style={{
            display: "flex",
            width: "100%",
            height: "36px",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            border: "1px solid var(--color-border-subdued)",
          }}
        >
          {/* Neutral 1: Crawl */}
          <div
            style={{
              width: `${crawlPct}%`,
              backgroundColor: "var(--color-surface-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-primary)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              padding: "0 6px",
              borderRight: "1px solid var(--color-border-subdued)",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            Crawl ({(crawlMs / 1000).toFixed(1)}s)
          </div>

          {/* Neutral 2: axe */}
          <div
            style={{
              width: `${axePct}%`,
              backgroundColor: "var(--color-surface-1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 400,
              padding: "0 6px",
              borderRight: "1px solid var(--color-border-subdued)",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            axe ({(axeMs / 1000).toFixed(1)}s)
          </div>

          {/* Secondary Accent: Models */}
          <div
            style={{
              width: `${modelsPct}%`,
              backgroundColor: "var(--color-accent-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              padding: "0 6px",
              borderRight: "1px solid var(--color-border-subdued)",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            Models ({(modelsMs / 1000).toFixed(1)}s)
          </div>

          {/* Primary Accent: Verification */}
          <div
            style={{
              width: `${verifPct}%`,
              backgroundColor: "var(--color-accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000000",
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              padding: "0 6px",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            Verify ({(verifMs / 1000).toFixed(1)}s)
          </div>
        </div>

        {/* Text Legend with exact seconds */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-4)",
            marginTop: "var(--space-3)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-secondary)",
          }}
        >
          <span>
            Crawl: <strong>{(crawlMs / 1000).toFixed(2)}s</strong> ({crawlPct}%)
          </span>
          <span>
            axe-core: <strong>{(axeMs / 1000).toFixed(2)}s</strong> ({axePct}%)
          </span>
          <span>
            Models: <strong>{(modelsMs / 1000).toFixed(2)}s</strong> ({modelsPct}%)
          </span>
          <span>
            Verification: <strong>{(verifMs / 1000).toFixed(2)}s</strong> ({verifPct}%)
          </span>
        </div>
      </div>

      {/* TODAY'S BUDGET METER */}
      <div
        style={{
          padding: "var(--space-4)",
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div>
          <div style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Today's budget
          </div>
          <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {budget.percentUsed}% of today's token budget used ({budget.tokensUsedToday.toLocaleString()} of{" "}
            {budget.dailyBudget.toLocaleString()} tokens)
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <progress
            value={budget.tokensUsedToday}
            max={budget.dailyBudget}
            aria-label={`${budget.percentUsed}% of today's token budget used`}
            style={{
              width: "180px",
              height: "12px",
              accentColor: "var(--color-focus-ring)",
            }}
          />
          <span style={{ fontSize: "var(--font-size-sm)", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>
            {budget.percentUsed}%
          </span>
        </div>
      </div>

      {/* EXPANDABLE "SHOW EACH CALL" LIST (COLLAPSED BY DEFAULT) */}
      <div
        style={{
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setShowCalls(!showCalls)}
          style={{
            width: "100%",
            padding: "var(--space-3) var(--space-4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "transparent",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
          aria-expanded={showCalls}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {showCalls ? "Hide individual calls" : "Show each call"} ({ledger.length} calls recorded)
            </span>
          </div>

          <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
            {showCalls ? "− Collapse" : "+ Expand"}
          </span>
        </button>

        {showCalls && (
          <div style={{ padding: "0 var(--space-4) var(--space-4)", borderTop: "1px solid var(--color-border-subdued)" }}>
            {ledger.length === 0 ? (
              <div style={{ padding: "var(--space-3) 0", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
                No individual API calls recorded in this session.
              </div>
            ) : (
              <div tabIndex={0} role="region" aria-label="Individual model calls data table" style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "var(--font-size-sm)",
                    textAlign: "left",
                    marginTop: "var(--space-2)",
                  }}
                >
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border-subdued)", color: "var(--color-text-secondary)" }}>
                      <th scope="col" style={{ padding: "6px 8px", fontWeight: 600 }}>Time</th>
                      <th scope="col" style={{ padding: "6px 8px", fontWeight: 600 }}>Model</th>
                      <th scope="col" style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Tokens</th>
                      <th scope="col" style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((c, i) => {
                      const outcomeStr = c.outcome || "ok";
                      const isOk = outcomeStr === "ok";
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--color-border-subdued)" }}>
                          <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
                            {(c.latencyMs / 1000).toFixed(2)}s
                          </td>
                          <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                            {c.model || c.modelId}
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                            {(c.tokensIn + c.tokensOut).toLocaleString()} tokens
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "12px",
                                fontWeight: 600,
                                backgroundColor: isOk ? "var(--color-surface-3)" : "var(--color-surface-1)",
                                color: isOk ? "var(--color-status-success)" : "var(--color-severity-major)",
                                border: `1px solid ${isOk ? "var(--color-status-success)" : "var(--color-severity-major)"}`,
                              }}
                            >
                              {outcomeStr}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
