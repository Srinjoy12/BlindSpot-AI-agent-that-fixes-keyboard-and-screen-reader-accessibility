// fix.ts — Ultra Stage 3: Fix proposal generation.
// Calls Nemotron Ultra to generate a surgical CSS, attribute, HTML, or script patch.
// Strictly linted: rejects dangerous network APIs, evals, and external imports.

import { getTokenFactoryClient, Models } from "./client.js";
import { ULTRA_FIX_PROMPT } from "./prompts.js";
import { FixProposalSchema, type FixProposal, type FindingAnalysis } from "./schemas.js";
import { recordCall } from "./ledger.js";

export interface FixRequest {
  finding: FindingAnalysis;
  elementHtmlSnippet?: string;
  surroundingContext?: string;
  previousAttempt?: {
    patch: FixProposal;
    verificationError: string;
  };
}

const DISALLOWED_PATTERNS = [
  /fetch\s*\(/i,
  /XMLHttpRequest/i,
  /WebSocket/i,
  /\beval\s*\(/i,
  /\bFunction\s*\(/i,
  /\bimport\s*\(/i,
  /https?:\/\//i,
  /document\.cookie/i,
  /localStorage/i,
  /sessionStorage/i,
];

export function lintPatch(patch: FixProposal): { valid: boolean; reason?: string } {
  for (const pattern of DISALLOWED_PATTERNS) {
    if (pattern.test(patch.body)) {
      return {
        valid: false,
        reason: `Patch violates security policy: contains forbidden pattern '${pattern.source}'.`,
      };
    }
  }
  return { valid: true };
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

export async function generateFix(request: FixRequest): Promise<FixProposal> {
  const client = getTokenFactoryClient();
  const model = Models.ULTRA;
  const start = Date.now();

  const dataPayload = {
    finding: request.finding,
    elementSnippet: request.elementHtmlSnippet,
    context: request.surroundingContext,
    previousFailure: request.previousAttempt
      ? {
          failedPatch: request.previousAttempt.patch,
          error: request.previousAttempt.verificationError,
        }
      : null,
  };

  const userContent = `<page_data>\n${JSON.stringify(dataPayload, null, 2)}\n</page_data>\n\nPropose a minimal, verified fix matching the FixProposal schema.`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: ULTRA_FIX_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "{}";
    const tokensIn = response.usage?.prompt_tokens ?? 0;
    const tokensOut = response.usage?.completion_tokens ?? 0;

    const parsedJson = JSON.parse(cleanJsonResponse(content));
    const proposal = FixProposalSchema.parse(parsedJson);

    // Run patch linter
    const lintResult = lintPatch(proposal);
    if (!lintResult.valid) {
      throw new Error(`Lint failure: ${lintResult.reason}`);
    }

    recordCall({
      id: crypto.randomUUID(),
      stage: "fix",
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      cacheHit: false,
      outcome: "success",
      timestamp: new Date().toISOString(),
    });

    return proposal;
  } catch (err) {
    const latencyMs = Date.now() - start;
    recordCall({
      id: crypto.randomUUID(),
      stage: "fix",
      model,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      cacheHit: false,
      outcome: "failed",
      timestamp: new Date().toISOString(),
    });

    // High quality deterministic fallbacks for known detector patterns
    return generateDeterministicFix(request.finding);
  }
}

function generateDeterministicFix(finding: FindingAnalysis): FixProposal {
  switch (finding.detectorId) {
    case "D1":
      return {
        patchType: "script",
        targetSelector: finding.selector,
        body: `
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const dialog = document.querySelector('${finding.selector}');
    if (dialog) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.style.display = 'none';
    }
  }
});`.trim(),
        rationale: "Adds standard Escape key listener to close the trapped modal dialog and restore page focus.",
      };

    case "D3":
      return {
        patchType: "css",
        targetSelector: finding.selector,
        body: `${finding.selector}:focus-visible { outline: 3px solid #2563eb !important; outline-offset: 2px !important; }`,
        rationale: "Restores a high-contrast focus indicator satisfying WCAG 2.4.7.",
      };

    case "D5":
      return {
        patchType: "css",
        targetSelector: finding.selector,
        body: `${finding.selector} { scroll-margin-top: 100px !important; }`,
        rationale: "Adds scroll-margin-top so element remains visible below sticky headers when focused.",
      };

    case "D6":
      return {
        patchType: "attribute",
        targetSelector: finding.selector,
        body: 'aria-label="Action"',
        rationale: "Provides an accessible name for screen readers on interactive control.",
      };

    case "D7":
      return {
        patchType: "attribute",
        targetSelector: finding.selector,
        body: 'tabindex="0"',
        rationale: "Replaces disruptive positive tabindex with standard tabindex=0 to restore logical reading order.",
      };

    case "D9":
      return {
        patchType: "html",
        targetSelector: "body",
        body: '<a href="#main-content" class="skip-link" style="position:absolute;top:-50px;left:0;background:#2563eb;color:#fff;padding:8px 16px;z-index:9999;" onfocus="this.style.top=\'0\'" onblur="this.style.top=\'-50px\'">Skip to main content</a>',
        rationale: "Inserts a keyboard bypass mechanism at the top of the body per WCAG 2.4.1.",
      };

    default:
      return {
        patchType: "css",
        targetSelector: finding.selector,
        body: `${finding.selector}:focus-visible { outline: 2px solid #2563eb !important; }`,
        rationale: "Standard focus indicator repair.",
      };
  }
}
