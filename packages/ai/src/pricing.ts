// pricing.ts — Nebius Token Factory pricing configuration.
// Copy the real prices from the Nebius Token Factory pricing page. Costs shown in the UI are estimates.

export interface ModelPricing {
  inputPerMTok: number;  // USD per 1M prompt tokens
  outputPerMTok: number; // USD per 1M completion tokens
}

/**
 * Model pricing table keyed by model identifier.
 * Copy the real prices from the Nebius Token Factory pricing page. Costs shown in the UI are estimates.
 */
function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process && process.env) {
    return process.env[key];
  }
  return undefined;
}

export const MODEL_PRICING_TABLE: Record<string, ModelPricing> = {
  // TODO: Copy real prices from Nebius Token Factory pricing page. These are placeholder defaults read from env/config.
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": {
    inputPerMTok: parseFloat(getEnv("PRICE_NANO_IN") ?? "0.15"),   // TODO: placeholder
    outputPerMTok: parseFloat(getEnv("PRICE_NANO_OUT") ?? "0.60"), // TODO: placeholder
  },
  "nvidia/nemotron-3-super-120b-a12b": {
    inputPerMTok: parseFloat(getEnv("PRICE_SUPER_IN") ?? "0.60"),  // TODO: placeholder
    outputPerMTok: parseFloat(getEnv("PRICE_SUPER_OUT") ?? "1.80"),// TODO: placeholder
  },
  "nvidia/Nemotron-3-Ultra-550b-a55b": {
    inputPerMTok: parseFloat(getEnv("PRICE_ULTRA_IN") ?? "1.20"),  // TODO: placeholder
    outputPerMTok: parseFloat(getEnv("PRICE_ULTRA_OUT") ?? "3.60"),// TODO: placeholder
  },
};

/**
 * Normalizes model identifiers to handle casing and aliases.
 */
function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

/**
 * Retrieves pricing configuration for a given model ID.
 * Returns null if the model has no configured pricing. Never returns a made-up number.
 */
export function getModelPricing(modelId?: string | null): ModelPricing | null {
  if (!modelId) return null;

  // Direct match
  if (MODEL_PRICING_TABLE[modelId]) {
    const p = MODEL_PRICING_TABLE[modelId];
    if (typeof p.inputPerMTok === "number" && !isNaN(p.inputPerMTok) &&
        typeof p.outputPerMTok === "number" && !isNaN(p.outputPerMTok)) {
      return p;
    }
  }

  // Normalized key match
  const norm = normalizeModelId(modelId);
  for (const [key, p] of Object.entries(MODEL_PRICING_TABLE)) {
    if (normalizeModelId(key) === norm) {
      if (typeof p.inputPerMTok === "number" && !isNaN(p.inputPerMTok) &&
          typeof p.outputPerMTok === "number" && !isNaN(p.outputPerMTok)) {
        return p;
      }
    }
  }

  // Partial substring match for known Nemotron tiers if prefixed or altered
  if (norm.includes("nano")) {
    return MODEL_PRICING_TABLE["nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"] ?? null;
  }
  if (norm.includes("super")) {
    return MODEL_PRICING_TABLE["nvidia/nemotron-3-super-120b-a12b"] ?? null;
  }
  if (norm.includes("ultra")) {
    return MODEL_PRICING_TABLE["nvidia/Nemotron-3-Ultra-550b-a55b"] ?? null;
  }

  // Price not configured
  return null;
}

/**
 * Calculates estimated USD cost for a model call.
 * Returns null if the model has no configured pricing (never returns a made-up number).
 */
export function estimateModelCost(
  modelId: string | undefined | null,
  tokensIn: number,
  tokensOut: number
): number | null {
  const pricing = getModelPricing(modelId);
  if (!pricing) return null;

  const cost =
    tokensIn * (pricing.inputPerMTok / 1_000_000) +
    tokensOut * (pricing.outputPerMTok / 1_000_000);

  return parseFloat(cost.toFixed(6));
}

/**
 * Computes estimated cost per verified fix.
 * Safely guards against division by zero (returns null when fixesVerified <= 0 or cost is null).
 */
export function calculateCostPerVerifiedFix(
  totalCostUsd: number | null | undefined,
  fixesVerified: number | undefined
): number | null {
  if (totalCostUsd === null || totalCostUsd === undefined) return null;
  if (!fixesVerified || fixesVerified <= 0) return null;
  return parseFloat((totalCostUsd / fixesVerified).toFixed(6));
}
