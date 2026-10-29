// digest.ts — Nano Stage 1: Page-state digests.
// Summarizes landmarks, widgets, and modal candidates per state for Super.
// Fast, lightweight, strictly bounded by StateDigestSchema.

import { getTokenFactoryClient, Models } from "./client.js";
import { NANO_DIGEST_PROMPT } from "./prompts.js";
import { StateDigestSchema, type StateDigest } from "./schemas.js";
import { recordCall } from "./ledger.js";
import { estimateModelCost } from "./pricing.js";

export interface DigestInput {
  url: string;
  stateLabel: string;
  focusStops: Array<{
    selector: string;
    tagName: string;
    role: string;
    accessibleName: string;
  }>;
  landmarkSummary?: string[];
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

export async function generateStateDigest(input: DigestInput): Promise<StateDigest> {
  const client = getTokenFactoryClient();
  const model = Models.NANO;
  const start = Date.now();

  const dataPayload = {
    url: input.url,
    stateLabel: input.stateLabel,
    totalFocusStops: input.focusStops.length,
    stops: input.focusStops.slice(0, 50),
    landmarks: input.landmarkSummary ?? [],
  };

  const userContent = `<page_data>\n${JSON.stringify(dataPayload, null, 2)}\n</page_data>\n\nGenerate the StateDigest JSON based strictly on the above page data.`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: NANO_DIGEST_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "{}";
    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;

    const parsedJson = JSON.parse(cleanJsonResponse(content));
    const digest = StateDigestSchema.parse(parsedJson);

    recordCall({
      id: crypto.randomUUID(),
      stage: "digest",
      tier: "Nano",
      modelId: model,
      tokensIn,
      tokensOut,
      latencyMs,
      cacheHit: false,
      outcome: "ok",
      estimatedCostUsd: estimateModelCost(model, tokensIn, tokensOut),
      timestamp: new Date().toISOString(),
    });

    return digest;
  } catch (err) {
    const latencyMs = Date.now() - start;
    recordCall({
      id: crypto.randomUUID(),
      stage: "digest",
      tier: "Nano",
      modelId: model,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      cacheHit: false,
      outcome: "fallback",
      estimatedCostUsd: 0,
      timestamp: new Date().toISOString(),
    });

    // Deterministic fallback if model or parsing fails
    return {
      pagePurpose: `Page audit state ${input.stateLabel} at ${input.url}`,
      landmarks: (input.landmarkSummary ?? []).map((l) => ({ role: "region", label: l })),
      widgets: input.focusStops
        .filter((s) => ["button", "dialog", "menu", "tab"].includes(s.role))
        .map((s) => ({
          selector: s.selector,
          role: s.role,
          name: s.accessibleName || s.selector,
          widgetType: (s.role === "dialog" ? "dialog" : s.role === "tab" ? "tabs" : "other") as any,
        })),
      likelyModals: input.focusStops
        .filter((s) => s.role === "dialog" || s.selector.includes("dialog") || s.selector.includes("modal"))
        .map((s) => s.selector),
      customControls: input.focusStops
        .filter((s) => s.tagName === "div" && s.role !== "generic")
        .map((s) => s.selector),
    };
  }
}
