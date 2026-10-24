#!/usr/bin/env tsx
// scripts/hello-models.ts
// Day-1 spike: send one prompt to each Nemotron tier and print model, latency and token counts.
// Run: npm run hello-models (from the repo root, with .env populated)

import "dotenv/config";
// dotenv reads .env from the current working directory (repo root).
// Fill in TF_API_KEY, TF_BASE_URL, MODEL_NANO, MODEL_SUPER, MODEL_ULTRA,
// and TAVILY_API_KEY in .env before running this script.
import { getTokenFactoryClient, Models, recordCall, ledgerTotals } from "../packages/ai/src/index.js";
import type { ModelCallRecord } from "../packages/ai/src/index.js";

const PROBE_PROMPT = "Reply with exactly this JSON and nothing else: {\"status\":\"ok\",\"model_responded\":true}";

interface ProbeResult {
  tier: string;
  model: string;
  reply: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

async function probeModel(tier: "NANO" | "SUPER" | "ULTRA"): Promise<ProbeResult> {
  const client = getTokenFactoryClient();
  const model = Models[tier];
  const start = Date.now();

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a test probe. Follow instructions exactly." },
        { role: "user", content: PROBE_PROMPT },
      ],
      temperature: 0,
      max_tokens: 100,
      // Request JSON output if the model supports it
      response_format: { type: "json_object" },
    });

    const latencyMs = Date.now() - start;
    const choice = response.choices[0];
    const reply = choice?.message?.content ?? "";
    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;

    const record: ModelCallRecord = {
      id: crypto.randomUUID(),
      stage: "digest",
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      cacheHit: false,
      outcome: "success",
      timestamp: new Date().toISOString(),
    };
    recordCall(record);

    return { tier, model, reply, tokensIn, tokensOut, latencyMs, ok: true };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    const record: ModelCallRecord = {
      id: crypto.randomUUID(),
      stage: "digest",
      model,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      cacheHit: false,
      outcome: "failed",
      timestamp: new Date().toISOString(),
    };
    recordCall(record);

    return { tier, model, reply: "", tokensIn: 0, tokensOut: 0, latencyMs, ok: false, error };
  }
}

async function probeTavily(): Promise<void> {
  const apiKey = process.env["TAVILY_API_KEY"];
  if (!apiKey) {
    console.log("\n⚠️  TAVILY_API_KEY not set — skipping Tavily probe");
    return;
  }

  const start = Date.now();
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: "WCAG 2.2 criterion 2.1.2 No Keyboard Trap",
        max_results: 1,
        search_depth: "basic",
      }),
    });

    const latencyMs = Date.now() - start;
    if (!response.ok) {
      console.log(`\n❌ Tavily HTTP ${response.status} in ${latencyMs}ms`);
      return;
    }

    const data = await response.json() as { results?: Array<{ url: string; content: string }> };
    const first = data.results?.[0];
    console.log("\n✅ Tavily probe");
    console.log(`   Latency: ${latencyMs}ms`);
    console.log(`   First result URL: ${first?.url ?? "none"}`);
    console.log(`   Snippet: ${(first?.content ?? "").slice(0, 120)}…`);
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.log(`\n❌ Tavily error in ${latencyMs}ms:`, err instanceof Error ? err.message : err);
  }
}

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("BlindSpot — Day-1 Spike: Token Factory + Tavily probe");
  console.log("=".repeat(60));
  console.log(`TF_BASE_URL: ${process.env["TF_BASE_URL"] ?? "(not set)"}`);
  console.log(`MODEL_NANO:  ${process.env["MODEL_NANO"] ?? "(not set)"}`);
  console.log(`MODEL_SUPER: ${process.env["MODEL_SUPER"] ?? "(not set)"}`);
  console.log(`MODEL_ULTRA: ${process.env["MODEL_ULTRA"] ?? "(not set)"}`);
  console.log("");

  const tiers: Array<"NANO" | "SUPER" | "ULTRA"> = ["NANO", "SUPER", "ULTRA"];
  const results: ProbeResult[] = [];

  for (const tier of tiers) {
    process.stdout.write(`Probing ${tier}... `);
    const result = await probeModel(tier);
    results.push(result);

    if (result.ok) {
      console.log(`✅ ${result.latencyMs}ms | in: ${result.tokensIn} out: ${result.tokensOut}`);
      console.log(`   Reply: ${result.reply.slice(0, 120)}`);
    } else {
      console.log(`❌ Error after ${result.latencyMs}ms`);
      console.log(`   ${result.error}`);
    }
  }

  // Tavily probe
  await probeTavily();

  // Summary
  const totals = ledgerTotals();
  console.log("\n" + "-".repeat(60));
  console.log("Summary");
  console.log("-".repeat(60));
  console.log(`Calls:        ${totals.totalCalls}`);
  console.log(`Tokens in:    ${totals.totalTokensIn}`);
  console.log(`Tokens out:   ${totals.totalTokensOut}`);
  console.log(`Total time:   ${totals.totalLatencyMs}ms`);

  const allOk = results.every((r) => r.ok);
  console.log("\n" + (allOk ? "🟢 All Token Factory tiers responded" : "🔴 Some tiers failed — check errors above"));

  if (!allOk) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
