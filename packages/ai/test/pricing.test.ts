import { describe, it, expect } from "vitest";
import {
  getModelPricing,
  estimateModelCost,
  calculateCostPerVerifiedFix,
  MODEL_PRICING_TABLE,
} from "../src/pricing.js";
import {
  aggregateLedger,
  type ModelCallRecord,
  type TavilyCallRecord,
} from "../src/ledger.js";

describe("Pricing and Ledger Aggregation", () => {
  describe("Missing price handling", () => {
    it("returns null for unknown models without configured pricing", () => {
      const unknownModel = "meta-llama/Llama-3-70b-instruct";
      expect(getModelPricing(unknownModel)).toBeNull();
      expect(estimateModelCost(unknownModel, 1000, 500)).toBeNull();
      expect(estimateModelCost(undefined, 1000, 500)).toBeNull();
      expect(estimateModelCost(null, 1000, 500)).toBeNull();
    });

    it("calculates estimated cost correctly for configured Nemotron tiers", () => {
      const nanoId = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
      const pricing = getModelPricing(nanoId);
      expect(pricing).not.toBeNull();
      expect(pricing?.inputPerMTok).toBeGreaterThan(0);
      expect(pricing?.outputPerMTok).toBeGreaterThan(0);

      const cost = estimateModelCost(nanoId, 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo((pricing!.inputPerMTok + pricing!.outputPerMTok), 4);
    });

    it("marks totalEstimatedCostUsd as null when any invoked model has missing pricing", () => {
      const records: ModelCallRecord[] = [
        {
          id: "call-1",
          stage: "digest",
          tier: "Nano",
          modelId: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
          tokensIn: 500,
          tokensOut: 200,
          latencyMs: 300,
          estimatedCostUsd: 0.0001,
          outcome: "ok",
          timestamp: new Date().toISOString(),
        },
        {
          id: "call-2",
          stage: "analysis",
          tier: "Super",
          modelId: "unknown/unpriced-model",
          tokensIn: 1000,
          tokensOut: 400,
          latencyMs: 700,
          estimatedCostUsd: null, // missing price!
          outcome: "ok",
          timestamp: new Date().toISOString(),
        },
      ];

      const agg = aggregateLedger(records, [], 1, 1000);
      expect(agg.tiers.nano.estimatedCostUsd).toBe(0.0001);
      expect(agg.tiers.super.estimatedCostUsd).toBeNull();
      // Total must never be a made-up number:
      expect(agg.totalEstimatedCostUsd).toBeNull();
      expect(agg.estimatedCostPerVerifiedFixUsd).toBeNull();
    });
  });

  describe("Per-verified-fix division by zero protection", () => {
    it("returns null when fixesVerified is 0 or negative", () => {
      expect(calculateCostPerVerifiedFix(0.05, 0)).toBeNull();
      expect(calculateCostPerVerifiedFix(0.05, -1)).toBeNull();
      expect(calculateCostPerVerifiedFix(0.05, undefined)).toBeNull();
    });

    it("returns null when total cost is null or undefined", () => {
      expect(calculateCostPerVerifiedFix(null, 3)).toBeNull();
      expect(calculateCostPerVerifiedFix(undefined, 3)).toBeNull();
    });

    it("computes cost per verified fix accurately when verified fixes exist", () => {
      expect(calculateCostPerVerifiedFix(0.012, 3)).toBe(0.004);
      expect(calculateCostPerVerifiedFix(0.005462, 1)).toBe(0.005462);
    });
  });

  describe("Ledger aggregation with mixed outcomes", () => {
    it("aggregates calls across all tiers and outcome types accurately", () => {
      const records: ModelCallRecord[] = [
        {
          id: "n1",
          stage: "digest",
          tier: "Nano",
          modelId: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
          tokensIn: 400,
          tokensOut: 150,
          latencyMs: 250,
          estimatedCostUsd: 0.00015,
          outcome: "ok",
          timestamp: new Date().toISOString(),
        },
        {
          id: "s1",
          stage: "analysis",
          tier: "Super",
          modelId: "nvidia/nemotron-3-super-120b-a12b",
          tokensIn: 1200,
          tokensOut: 400,
          latencyMs: 1800,
          estimatedCostUsd: 0.00144,
          outcome: "ok",
          timestamp: new Date().toISOString(),
        },
        {
          id: "s2",
          stage: "analysis",
          tier: "Super",
          modelId: "nvidia/nemotron-3-super-120b-a12b",
          tokensIn: 0,
          tokensOut: 0,
          latencyMs: 500,
          estimatedCostUsd: 0,
          outcome: "fallback",
          timestamp: new Date().toISOString(),
        },
        {
          id: "u1",
          stage: "fix-attempt-1",
          tier: "Ultra",
          modelId: "nvidia/Nemotron-3-Ultra-550b-a55b",
          findingId: "barrier_1",
          tokensIn: 1500,
          tokensOut: 500,
          latencyMs: 3200,
          estimatedCostUsd: 0.0036,
          outcome: "invalid-json",
          timestamp: new Date().toISOString(),
        },
        {
          id: "u2",
          stage: "fix-attempt-2",
          tier: "Ultra",
          modelId: "nvidia/Nemotron-3-Ultra-550b-a55b",
          findingId: "barrier_1",
          tokensIn: 1600,
          tokensOut: 600,
          latencyMs: 2800,
          estimatedCostUsd: 0.00408,
          outcome: "ok",
          timestamp: new Date().toISOString(),
        },
      ];

      const tavilyRecords: TavilyCallRecord[] = [
        {
          id: "t1",
          query: "WCAG 2.1.2 No Keyboard Trap",
          latencyMs: 420,
          timestamp: new Date().toISOString(),
        },
      ];

      const agg = aggregateLedger(records, tavilyRecords, 1, 8500);

      // Verify overall totals
      expect(agg.totalCalls).toBe(5);
      expect(agg.totalTokensIn).toBe(400 + 1200 + 0 + 1500 + 1600); // 4700
      expect(agg.totalTokensOut).toBe(150 + 400 + 0 + 500 + 600); // 1650
      expect(agg.totalTokens).toBe(4700 + 1650); // 6350
      expect(agg.totalLatencyMs).toBe(250 + 1800 + 500 + 3200 + 2800); // 8550
      expect(agg.wallClockDurationMs).toBe(8500);

      // Total cost sum
      const expectedTotalCost = parseFloat((0.00015 + 0.00144 + 0 + 0.0036 + 0.00408).toFixed(6));
      expect(agg.totalEstimatedCostUsd).toBe(expectedTotalCost);
      expect(agg.estimatedCostPerVerifiedFixUsd).toBe(expectedTotalCost); // 1 verified fix

      // Verify Tier Nano
      expect(agg.tiers.nano.calls).toBe(1);
      expect(agg.tiers.nano.job).toBe("Summarises page state");
      expect(agg.tiers.nano.tokensIn).toBe(400);
      expect(agg.tiers.nano.tokensOut).toBe(150);
      expect(agg.tiers.nano.outcomes.ok).toBe(1);

      // Verify Tier Super
      expect(agg.tiers.super.calls).toBe(2);
      expect(agg.tiers.super.job).toBe("Ranks severity and explains impact");
      expect(agg.tiers.super.outcomes.ok).toBe(1);
      expect(agg.tiers.super.outcomes.fallback).toBe(1);
      expect(agg.tiers.super.meanLatencyMs).toBe(Math.round((1800 + 500) / 2));

      // Verify Tier Ultra
      expect(agg.tiers.ultra.calls).toBe(2);
      expect(agg.tiers.ultra.job).toBe("Writes the fix");
      expect(agg.tiers.ultra.outcomes["invalid-json"]).toBe(1);
      expect(agg.tiers.ultra.outcomes.ok).toBe(1);

      // Verify Tavily tracking (latency and calls only, no cost)
      expect(agg.tavily.calls).toBe(1);
      expect(agg.tavily.totalLatencyMs).toBe(420);
      expect(agg.tavily.meanLatencyMs).toBe(420);
    });
  });
});
