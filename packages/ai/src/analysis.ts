// analysis.ts — Super Stage 2: Issue analysis & WCAG mapping.
// Synthesizes detector hits and state digests into structured findings.
// Grounded by Tavily research on WCAG criteria and techniques.

import { getTokenFactoryClient, Models } from "./client.js";
import { SUPER_ANALYSIS_PROMPT } from "./prompts.js";
import { FindingAnalysisSchema, type FindingAnalysis, type StateDigest } from "./schemas.js";
import { recordCall } from "./ledger.js";
import { searchWcag } from "./tavily.js";
import { z } from "zod";

export interface AnalysisInput {
  hits: Array<{
    detectorId: string;
    selector: string;
    stateLabel: string;
    stopIndexes: number[];
    evidence: string;
    confidence: number;
    severity: string;
    wcagId: string;
  }>;
  digests: StateDigest[];
  url: string;
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

const WCAG_NAMES: Record<string, { name: string; level: "A" | "AA" | "AAA"; url: string }> = {
  "2.1.1": { name: "Keyboard", level: "A", url: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard" },
  "2.1.2": { name: "No Keyboard Trap", level: "A", url: "https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap" },
  "2.4.1": { name: "Bypass Blocks", level: "A", url: "https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks" },
  "2.4.3": { name: "Focus Order", level: "A", url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-order" },
  "2.4.7": { name: "Focus Visible", level: "AA", url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-visible" },
  "2.4.11": { name: "Focus Not Obscured (Minimum)", level: "AA", url: "https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum" },
  "4.1.2": { name: "Name, Role, Value", level: "A", url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value" },
};

export async function analyzeFindings(input: AnalysisInput): Promise<FindingAnalysis[]> {
  if (input.hits.length === 0) return [];

  const client = getTokenFactoryClient();
  const model = Models.SUPER;
  const start = Date.now();

  // Ground with Tavily for the most severe hit
  const primaryHit = input.hits[0];
  const wcagSearch = primaryHit
    ? await searchWcag(primaryHit.wcagId, primaryHit.detectorId)
    : null;

  const dataPayload = {
    url: input.url,
    totalHits: input.hits.length,
    detectorHits: input.hits,
    stateDigests: input.digests,
    tavilyReference: wcagSearch ? { query: wcagSearch.query, snippet: wcagSearch.content.slice(0, 400) } : null,
  };

  const userContent = `<page_data>\n${JSON.stringify(dataPayload, null, 2)}\n</page_data>\n\nReturn JSON array matching FindingAnalysis[] for each verified barrier above.`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SUPER_ANALYSIS_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "{}";
    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;

    const parsedJson = JSON.parse(cleanJsonResponse(content));
    const items = Array.isArray(parsedJson) ? parsedJson : (parsedJson.findings || parsedJson.items || []);
    const findings = z.array(FindingAnalysisSchema).parse(items);

    recordCall({
      id: crypto.randomUUID(),
      stage: "analysis",
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      cacheHit: false,
      outcome: "success",
      timestamp: new Date().toISOString(),
    });

    // Anti-hallucination check: ensure every finding matches an actual detector hit
    const validDetectorIds = new Set(input.hits.map((h) => h.detectorId));
    return findings.filter((f) => validDetectorIds.has(f.detectorId));
  } catch {
    const latencyMs = Date.now() - start;
    recordCall({
      id: crypto.randomUUID(),
      stage: "analysis",
      model,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      cacheHit: false,
      outcome: "failed",
      timestamp: new Date().toISOString(),
    });

    // Deterministic fallback based directly on detector hits
    return input.hits.map((hit) => {
      const info = WCAG_NAMES[hit.wcagId] ?? {
        name: `WCAG Criterion ${hit.wcagId}`,
        level: "AA",
        url: `https://www.w3.org/WAI/WCAG22/quickref/#${hit.wcagId}`,
      };

      return {
        detectorId: hit.detectorId as any,
        severity: (hit.severity || "major") as any,
        wcag: {
          id: hit.wcagId,
          name: info.name,
          level: info.level,
          referenceUrl: info.url,
        },
        selector: hit.selector,
        stateLabel: hit.stateLabel,
        impact: `Users navigating with keyboard or assistive technology cannot properly interact with ${hit.selector}: ${hit.evidence.slice(0, 150)}`,
        confidence: hit.confidence,
      };
    });
  }
}
