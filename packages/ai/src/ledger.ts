// ledger.ts — Records every model invocation and retrieval call for model routing,
// spend visibility, and deterministic verification transparency.

import { estimateModelCost, calculateCostPerVerifiedFix } from "./pricing.js";

export type ModelStage =
  | "digest"
  | "analysis"
  | `fix-attempt-${number}`
  | "extension-fix"
  | string;

export type ModelTier = "Nano" | "Super" | "Ultra";

export type ModelOutcome = "ok" | "retried" | "invalid-json" | "fallback" | "error";

export interface ModelCallRecord {
  id: string;
  auditId?: string;
  stage: ModelStage;
  tier: ModelTier;
  modelId: string;
  model?: string; // alias for modelId
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  estimatedCostUsd: number | null;
  outcome: ModelOutcome;
  timestamp: string;
  findingId?: string;
  cacheHit?: boolean;
}

export interface TavilyCallRecord {
  id: string;
  query: string;
  latencyMs: number;
  timestamp: string;
}

export interface TierSummary {
  tier: ModelTier;
  job: string;
  modelId: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  totalLatencyMs: number;
  meanLatencyMs: number;
  estimatedCostUsd: number | null;
  outcomes: Record<ModelOutcome, number>;
}

export interface LedgerAggregate {
  tiers: {
    nano: TierSummary;
    super: TierSummary;
    ultra: TierSummary;
  };
  tavily: {
    calls: number;
    totalLatencyMs: number;
    meanLatencyMs: number;
  };
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  totalLatencyMs: number;
  totalEstimatedCostUsd: number | null;
  estimatedCostPerVerifiedFixUsd: number | null;
  wallClockDurationMs: number;
}

const TIER_JOBS: Record<ModelTier, string> = {
  Nano: "Summarises page state",
  Super: "Ranks severity and explains impact",
  Ultra: "Writes the fix",
};

const _ledger: ModelCallRecord[] = [];
const _tavilyLedger: TavilyCallRecord[] = [];

export function recordCall(entry: ModelCallRecord): void {
  // Ensure model and modelId are synchronized
  const modelId = entry.modelId || entry.model || "unknown";
  const cost =
    entry.estimatedCostUsd !== undefined
      ? entry.estimatedCostUsd
      : estimateModelCost(modelId, entry.tokensIn, entry.tokensOut);

  _ledger.push({
    ...entry,
    modelId,
    model: modelId,
    estimatedCostUsd: cost,
  });
}

export function recordTavilyCall(entry: TavilyCallRecord): void {
  _tavilyLedger.push(entry);
}

export function getLedger(): readonly ModelCallRecord[] {
  return _ledger;
}

export function getTavilyLedger(): readonly TavilyCallRecord[] {
  return _tavilyLedger;
}

export function clearLedger(): void {
  _ledger.length = 0;
  _tavilyLedger.length = 0;
}

/**
 * Computes comprehensive aggregated statistics by tier and overall run totals.
 */
export function aggregateLedger(
  records: readonly ModelCallRecord[] = _ledger,
  tavilyRecords: readonly TavilyCallRecord[] = _tavilyLedger,
  fixesVerified = 0,
  wallClockDurationMs = 0
): LedgerAggregate {
  const initTier = (tier: ModelTier, defaultModelId: string): TierSummary => ({
    tier,
    job: TIER_JOBS[tier],
    modelId: defaultModelId,
    calls: 0,
    tokensIn: 0,
    tokensOut: 0,
    totalTokens: 0,
    totalLatencyMs: 0,
    meanLatencyMs: 0,
    estimatedCostUsd: 0,
    outcomes: { ok: 0, retried: 0, "invalid-json": 0, fallback: 0, error: 0 },
  });

  const nanoTier = initTier("Nano", "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
  const superTier = initTier("Super", "nvidia/nemotron-3-super-120b-a12b");
  const ultraTier = initTier("Ultra", "nvidia/Nemotron-3-Ultra-550b-a55b");

  const tiers: { nano: TierSummary; super: TierSummary; ultra: TierSummary } = {
    nano: nanoTier,
    super: superTier,
    ultra: ultraTier,
  };

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalLatencyMs = 0;
  let hasMissingTierPrice = false;
  let sumCost = 0;

  for (const record of records) {
    totalTokensIn += record.tokensIn;
    totalTokensOut += record.tokensOut;
    totalLatencyMs += record.latencyMs;

    const tierStr = (record.tier || "Nano").toLowerCase();
    const t: TierSummary = tierStr.includes("super")
      ? tiers.super
      : tierStr.includes("ultra")
      ? tiers.ultra
      : tiers.nano;

    t.calls += 1;
    t.tokensIn += record.tokensIn;
    t.tokensOut += record.tokensOut;
    t.totalTokens += record.tokensIn + record.tokensOut;
    t.totalLatencyMs += record.latencyMs;
    if (record.modelId) t.modelId = record.modelId;

    const outcomeKey = record.outcome as ModelOutcome;
    if (t.outcomes[outcomeKey] !== undefined) {
      t.outcomes[outcomeKey] += 1;
    } else {
      t.outcomes.ok += 1;
    }

    if (record.estimatedCostUsd === null) {
      t.estimatedCostUsd = null;
      hasMissingTierPrice = true;
    } else if (t.estimatedCostUsd !== null) {
      t.estimatedCostUsd = parseFloat((t.estimatedCostUsd + record.estimatedCostUsd).toFixed(6));
      sumCost += record.estimatedCostUsd;
    }
  }

  // Calculate mean latencies
  for (const t of Object.values(tiers)) {
    t.meanLatencyMs = t.calls > 0 ? Math.round(t.totalLatencyMs / t.calls) : 0;
  }

  const tavilyLatency = tavilyRecords.reduce((sum, r) => sum + r.latencyMs, 0);
  const tavilyCallsCount = tavilyRecords.length;
  const tavilyMeanLatency = tavilyCallsCount > 0 ? Math.round(tavilyLatency / tavilyCallsCount) : 0;

  const totalEstimatedCostUsd = hasMissingTierPrice ? null : parseFloat(sumCost.toFixed(6));
  const estimatedCostPerVerifiedFixUsd = calculateCostPerVerifiedFix(
    totalEstimatedCostUsd,
    fixesVerified
  );

  return {
    tiers: {
      nano: tiers.nano,
      super: tiers.super,
      ultra: tiers.ultra,
    },
    tavily: {
      calls: tavilyCallsCount,
      totalLatencyMs: tavilyLatency,
      meanLatencyMs: tavilyMeanLatency,
    },
    totalCalls: records.length,
    totalTokensIn,
    totalTokensOut,
    totalTokens: totalTokensIn + totalTokensOut,
    totalLatencyMs,
    totalEstimatedCostUsd,
    estimatedCostPerVerifiedFixUsd,
    wallClockDurationMs,
  };
}

export function ledgerTotals(): {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalLatencyMs: number;
  totalEstimatedCostUsd: number | null;
} {
  const agg = aggregateLedger();
  return {
    totalCalls: agg.totalCalls,
    totalTokensIn: agg.totalTokensIn,
    totalTokensOut: agg.totalTokensOut,
    totalLatencyMs: agg.totalLatencyMs,
    totalEstimatedCostUsd: agg.totalEstimatedCostUsd,
  };
}
