// fix.ts — Ultra Stage 3: Fix proposal generation.
// Calls Nemotron Ultra to generate a surgical CSS, attribute, HTML, or script patch.
// Strictly linted: rejects dangerous network APIs, evals, and external imports.

import { getTokenFactoryClient, Models } from "./client.js";
import { ULTRA_FIX_PROMPT, ULTRA_SOURCE_FIX_PROMPT } from "./prompts.js";
import {
  FixProposalSchema,
  SourceFixResponseSchema,
  UltraSourceFixOutputSchema,
  type FixProposal,
  type SourceFixResponse,
  type FindingAnalysis,
} from "./schemas.js";
import { recordCall, type ModelStage } from "./ledger.js";
import { estimateModelCost } from "./pricing.js";

export interface FixRequest {
  finding: FindingAnalysis;
  elementHtmlSnippet?: string;
  surroundingContext?: string;
  attempt?: number;
  findingId?: string;
  stage?: ModelStage;
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
  const stage = request.stage || (request.attempt ? `fix-attempt-${request.attempt}` : "fix-attempt-1");
  const findingId = request.findingId || (request.finding as any)?.id || request.finding?.detectorId;

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

  let tokensIn = 0;
  let tokensOut = 0;

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
    tokensIn = response.usage?.prompt_tokens ?? 0;
    tokensOut = response.usage?.completion_tokens ?? 0;

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleanJsonResponse(content));
    } catch {
      recordCall({
        id: crypto.randomUUID(),
        stage,
        tier: "Ultra",
        modelId: model,
        model,
        tokensIn,
        tokensOut,
        latencyMs,
        estimatedCostUsd: estimateModelCost(model, tokensIn, tokensOut),
        cacheHit: false,
        outcome: "invalid-json",
        findingId,
        timestamp: new Date().toISOString(),
      });
      return generateDeterministicFix(request.finding);
    }

    const proposal = FixProposalSchema.parse(parsedJson);

    // Run patch linter
    const lintResult = lintPatch(proposal);
    if (!lintResult.valid) {
      throw new Error(`Lint failure: ${lintResult.reason}`);
    }

    recordCall({
      id: crypto.randomUUID(),
      stage,
      tier: "Ultra",
      modelId: model,
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      estimatedCostUsd: estimateModelCost(model, tokensIn, tokensOut),
      cacheHit: false,
      outcome: "ok",
      findingId,
      timestamp: new Date().toISOString(),
    });

    return proposal;
  } catch (err) {
    const latencyMs = Date.now() - start;
    recordCall({
      id: crypto.randomUUID(),
      stage,
      tier: "Ultra",
      modelId: model,
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      estimatedCostUsd: estimateModelCost(model, tokensIn, tokensOut) ?? 0,
      cacheHit: false,
      outcome: "fallback",
      findingId,
      timestamp: new Date().toISOString(),
    });

    // High quality deterministic fallbacks for known detector patterns
    return generateDeterministicFix(request.finding);
  }
}

function generateDeterministicFix(finding: FindingAnalysis): FixProposal {
  switch (finding.detectorId as string) {
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

export interface SourceFixRequest {
  source: string;
  finding: FindingAnalysis;
  attempt?: number;
  findingId?: string;
  stage?: ModelStage;
  wcagGuidance?: string;
  previousAttempt?: {
    modifiedSource: string;
    verificationError: string;
  };
}

export function applySurgicalPatchToSource(
  source: string,
  patch: {
    modifiedSource?: string | undefined;
    targetString?: string | undefined;
    replacementString?: string | undefined;
    patchType?: "css" | "attribute" | "html" | "script" | "replace" | undefined;
    body?: string | undefined;
    targetSelector?: string | undefined;
  }
): string {
  // 1. If full modifiedSource is explicitly provided and doesn't look empty, use it
  if (patch.modifiedSource && patch.modifiedSource.trim().length > 0) {
    return patch.modifiedSource;
  }

  // 2. Direct string replacement (surgical & preserves 100% of rest of file)
  if (patch.targetString && typeof patch.replacementString === "string") {
    if (source.includes(patch.targetString)) {
      return source.replace(patch.targetString, patch.replacementString);
    }
    // Try trimmed version if whitespace differs
    const trimmedTarget = patch.targetString.trim();
    if (trimmedTarget.length >= 4 && source.includes(trimmedTarget)) {
      return source.replace(trimmedTarget, patch.replacementString.trim());
    }
  }

  // 3. CSS rule injection
  if (patch.patchType === "css" || (patch.body && (patch.body.includes("{") || patch.body.includes(":")))) {
    const cssContent = (patch.body || "").trim();
    if (cssContent) {
      if (source.includes("</style>")) {
        return source.replace("</style>", `  ${cssContent}\n</style>`);
      }
      if (source.includes("</head>")) {
        return source.replace("</head>", `<style>\n  ${cssContent}\n</style>\n</head>`);
      }
      return source + `\n<style>\n${cssContent}\n</style>`;
    }
  }

  // 4. Attribute patch
  if (patch.patchType === "attribute" && patch.body) {
    const sel = patch.targetSelector || "";
    const idOrClass = sel.replace(/^[#.]/, "");
    if (idOrClass && source.includes(idOrClass)) {
      const needle = source.includes(`id="${idOrClass}"`)
        ? `id="${idOrClass}"`
        : source.includes(`class="${idOrClass}"`)
        ? `class="${idOrClass}"`
        : idOrClass;
      return source.replace(needle, `${needle} ${patch.body.trim()}`);
    }
  }

  // 5. HTML patch
  if (patch.patchType === "html" && patch.body) {
    if (source.includes("<body")) {
      return source.replace(/<body([^>]*)>/i, `<body$1>\n  ${patch.body.trim()}`);
    }
    return patch.body.trim() + "\n" + source;
  }

  // 6. Script patch
  if (patch.patchType === "script" && patch.body) {
    if (source.includes("</body>")) {
      return source.replace("</body>", `<script>\n${patch.body.trim()}\n</script>\n</body>`);
    }
    return source + `\n<script>\n${patch.body.trim()}\n</script>`;
  }

  return source;
}

export function extractContextForSelector(source: string, selector: string): string {
  if (source.length <= 2500) {
    return source;
  }

  const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
  const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
  const token = idMatch ? idMatch[1] : classMatch ? classMatch[1] : null;

  let targetIndex = -1;
  if (token) {
    // Try attribute matches first
    targetIndex = source.indexOf(`id="${token}"`);
    if (targetIndex === -1) targetIndex = source.indexOf(`id='${token}'`);
    if (targetIndex === -1) targetIndex = source.indexOf(`class="${token}"`);
    if (targetIndex === -1) targetIndex = source.indexOf(`class='${token}'`);
    if (targetIndex === -1) targetIndex = source.indexOf(token);
  }

  if (targetIndex === -1 && selector) {
    // Try tag names e.g. <img, <button, <a
    const tagMatch = selector.match(/^[a-zA-Z0-9]+/);
    if (tagMatch) {
      const tagNeedle = `<${tagMatch[0]}`;
      targetIndex = source.indexOf(tagNeedle);
    }
    if (targetIndex === -1) {
      const cleanSel = selector.split(/[ >:+]/)[0] || "";
      if (cleanSel && cleanSel.length > 2) targetIndex = source.indexOf(cleanSel);
    }
  }

  if (targetIndex !== -1) {
    const start = Math.max(0, source.lastIndexOf("\n", Math.max(0, targetIndex - 1200)));
    const end = Math.min(
      source.length,
      source.indexOf("\n", targetIndex + 1200) !== -1 ? source.indexOf("\n", targetIndex + 1200) : source.length
    );

    let styleHeader = "";
    const styleStart = source.indexOf("<style");
    const styleEnd = source.indexOf("</style>");
    if (styleStart !== -1 && styleEnd !== -1 && styleEnd - styleStart < 4000) {
      styleHeader = source.slice(styleStart, styleEnd + 8) + "\n\n/* ... HTML content excerpt around target element ... */\n\n";
    }

    return `${styleHeader}<!-- Excerpt for ${selector} -->\n${source.slice(start, end)}`;
  }

  return source.slice(0, 2500);
}

export async function generateSourceFix(request: SourceFixRequest): Promise<SourceFixResponse> {
  const client = getTokenFactoryClient();
  const model = Models.ULTRA;
  const start = Date.now();
  const stage = request.stage || (request.attempt ? `fix-attempt-${request.attempt}` : "fix-attempt-1");
  const findingId = request.findingId || (request.finding as any)?.id || request.finding?.detectorId;

  const sourcePayload = extractContextForSelector(request.source, request.finding.selector);

  const dataPayload = {
    source: sourcePayload,
    isExcerpt: sourcePayload.length < request.source.length,
    finding: {
      detectorId: request.finding.detectorId,
      severity: request.finding.severity,
      selector: request.finding.selector,
      wcag: request.finding.wcag,
      impact: request.finding.impact,
    },
    wcagGuidance:
      request.wcagGuidance ||
      `WCAG ${request.finding.wcag.id} (${request.finding.wcag.name}): Interactive controls must be reachable, operable via standard keyboard events, and not trap user focus.`,
    previousFailure: request.previousAttempt
      ? {
          failedAttemptSnippet: request.previousAttempt.modifiedSource.slice(0, 1500),
          error: request.previousAttempt.verificationError,
        }
      : null,
  };

  const userContent = `<page_data>\n${JSON.stringify(dataPayload, null, 2)}\n</page_data>\n\nPropose a minimal surgical fix. DO NOT output the full source code or entire document. Return JSON with either:\n1. {"targetString": "...", "replacementString": "...", "explanation": "..."}\n2. {"patchType": "css", "body": "...", "explanation": "..."}`;

  let tokensIn = 0;
  let tokensOut = 0;

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: ULTRA_SOURCE_FIX_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: "json_object" },
      },
      { timeout: 15000 }
    );

    const latencyMs = Date.now() - start;
    const content = response.choices[0]?.message?.content ?? "{}";
    tokensIn = response.usage?.prompt_tokens ?? 0;
    tokensOut = response.usage?.completion_tokens ?? 0;

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleanJsonResponse(content));
    } catch {
      recordCall({
        id: crypto.randomUUID(),
        stage,
        tier: "Ultra",
        modelId: model,
        model,
        tokensIn,
        tokensOut,
        latencyMs,
        estimatedCostUsd: estimateModelCost(model, tokensIn, tokensOut),
        cacheHit: false,
        outcome: "invalid-json",
        findingId,
        timestamp: new Date().toISOString(),
      });
      return generateDeterministicSourceFix(request.source, request.finding);
    }

    const result = UltraSourceFixOutputSchema.parse(parsedJson);

    let finalModifiedSource = applySurgicalPatchToSource(request.source, result);
    if (!finalModifiedSource || finalModifiedSource === request.source) {
      // If surgical string didn't match, apply deterministic fallback
      const det = generateDeterministicSourceFix(request.source, request.finding);
      finalModifiedSource = det.modifiedSource || request.source;
    }

    const completeResult: SourceFixResponse = {
      modifiedSource: finalModifiedSource,
      explanation: result.explanation || "Accessibility repair applied to source.",
      changedRegionsHint: result.changedRegionsHint || [],
    };

    recordCall({
      id: crypto.randomUUID(),
      stage,
      tier: "Ultra",
      modelId: model,
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      estimatedCostUsd: estimateModelCost(model, tokensIn, tokensOut),
      cacheHit: false,
      outcome: "ok",
      findingId,
      timestamp: new Date().toISOString(),
    });

    return completeResult;
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    recordCall({
      id: crypto.randomUUID(),
      stage,
      tier: "Ultra",
      modelId: model,
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      estimatedCostUsd: estimateModelCost(model, tokensIn, tokensOut),
      cacheHit: false,
      outcome: "error",
      findingId,
      timestamp: new Date().toISOString(),
    });
    return generateDeterministicSourceFix(request.source, request.finding);
  }
}

export function generateDeterministicSourceFix(source: string, finding: FindingAnalysis): SourceFixResponse {
  const sel = finding.selector;
  switch (finding.detectorId as string) {
    case "D1": {
      if (source.includes("trapElements") && source.includes("e.preventDefault()")) {
        const cleaned = source.replace(/e\.preventDefault\(\);\s*trapElements\[\d+\]\.focus\(\);/g, "// Tab trap removed to allow natural focus exit");
        return {
          modifiedSource: cleaned,
          explanation: "Removed artificial preventDefault on Tab key to allow keyboard focus to naturally exit the dialog.",
          changedRegionsHint: ["Removed Tab key trapping preventDefault calls"],
        };
      }
      // Escape key listener to close trapped modal/dialog
      if (source.includes("</script>")) {
        const fixScript = `
  // BlindSpot Fix: Allow Escape key to release trapped dialog
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const dialog = document.querySelector('${sel}') || document.querySelector('[role="dialog"]') || document.querySelector('.dialog') || document.querySelector('.overlay');
      if (dialog) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.setAttribute('hidden', '');
      }
    }
  });
</script>`;
        return {
          modifiedSource: source.replace("</script>", fixScript),
          explanation: "Added Escape keydown listener to allow keyboard users to dismiss modal and escape focus trap.",
          changedRegionsHint: ["Added Escape key event handler in script block"],
        };
      }
      return {
        modifiedSource:
          source +
          `\n<script>\ndocument.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelector('${sel}')?.setAttribute('hidden', ''); } });\n</script>`,
        explanation: "Added Escape key listener to release trapped dialog.",
        changedRegionsHint: ["Appended Escape listener script"],
      };
    }

    case "D3": {
      // Restores visible focus
      if (source.includes("outline: none !important;")) {
        return {
          modifiedSource: source.replace(
            "outline: none !important;",
            ":focus-visible { outline: 2px solid #2563eb !important; }"
          ),
          explanation: "Replaced global outline reset with high-contrast :focus-visible outline.",
          changedRegionsHint: ["Replaced global outline reset in stylesheet"],
        };
      }
      if (source.includes("outline: none;")) {
        return {
          modifiedSource: source.replace(
            "outline: none;",
            ":focus-visible { outline: 2px solid #2563eb !important; }"
          ),
          explanation: "Replaced outline reset with :focus-visible outline.",
          changedRegionsHint: ["Replaced outline: none in stylesheet"],
        };
      }
      if (source.includes("</style>")) {
        return {
          modifiedSource: source.replace("</style>", `  ${sel}:focus-visible { outline: 2px solid #2563eb !important; }\n</style>`),
          explanation: "Added high-contrast focus indicator in stylesheet.",
          changedRegionsHint: ["Added focus indicator style rule"],
        };
      }
      return {
        modifiedSource: source + `\n<style>${sel}:focus-visible { outline: 2px solid #2563eb !important; }</style>`,
        explanation: "Added focus indicator style.",
        changedRegionsHint: ["Added focus-visible style"],
      };
    }

    case "D4":
    case "D7": {
      // Replace positive tabindex
      const cleaned = source.replace(/tabindex=["']?[1-9]\d*["']?/g, 'tabindex="0"');
      return {
        modifiedSource: cleaned,
        explanation: "Replaced positive tabindex with tabindex='0' to restore standard DOM reading order.",
        changedRegionsHint: ["Replaced positive tabindex attribute with tabindex=0"],
      };
    }

    case "D6": {
      // Missing accessible name
      const idMatch = sel.match(/#([a-zA-Z0-9_-]+)/);
      if (idMatch && source.includes(`id="${idMatch[1]}"`)) {
        return {
          modifiedSource: source.replace(`id="${idMatch[1]}"`, `id="${idMatch[1]}" aria-label="Action"`),
          explanation: "Added aria-label attribute to provide accessible name.",
          changedRegionsHint: ["Added aria-label to interactive element"],
        };
      }
      return {
        modifiedSource: source,
        explanation: "Could not safely locate element to add accessible name.",
        changedRegionsHint: [],
      };
    }

    case "D8": {
      // Dialog / Banner focus mismanaged
      // If cookie banner dismissal loses focus
      if (source.includes("function dismissBanner()") && source.includes("banner.remove();")) {
        return {
          modifiedSource: source.replace(
            "banner.remove();",
            "banner.remove();\n    // Restore focus after banner dismissal\n    document.querySelector('nav a, main a, button')?.focus();"
          ),
          explanation: "Restores focus to a logical navigation element when the cookie banner is dismissed.",
          changedRegionsHint: ["Restored focus on dismissBanner"],
        };
      }
      if (source.includes("</script>")) {
        return {
          modifiedSource: source.replace(
            "</script>",
            `  // BlindSpot Fix: move initial focus to alertdialog or banner\n  window.addEventListener('DOMContentLoaded', () => { document.querySelector('${sel}')?.focus(); });\n</script>`
          ),
          explanation: "Moves keyboard focus into the dialog upon load.",
          changedRegionsHint: ["Added focus management on DOMContentLoaded"],
        };
      }
      return {
        modifiedSource: source,
        explanation: "Could not apply deterministic D8 fix.",
        changedRegionsHint: [],
      };
    }

    case "D2": {
      // Custom clickable div without keyboard access
      const idOrClass = sel.replace(/^[#.]/, "");
      if (source.includes(idOrClass)) {
        const targetStr = source.includes(`id="${idOrClass}"`) ? `id="${idOrClass}"` : `class="${idOrClass}"`;
        return {
          modifiedSource: source.replace(targetStr, `${targetStr} tabindex="0" role="button"`),
          explanation: "Added tabindex='0' and role='button' so custom control is reachable via keyboard.",
          changedRegionsHint: ["Added tabindex='0' and role='button'"],
        };
      }
      return {
        modifiedSource: source,
        explanation: "Could not locate custom element to add keyboard accessibility.",
        changedRegionsHint: [],
      };
    }

    case "AXE-color-contrast": {
      if (source.includes("</style>")) {
        return {
          modifiedSource: source.replace("</style>", `  ${sel} { color: #112018 !important; }\n</style>`),
          explanation: `Increased text contrast for '${sel}' to satisfy WCAG 4.5:1 ratio.`,
          changedRegionsHint: ["Added high contrast override in stylesheet"],
        };
      }
      return {
        modifiedSource: source + `\n<style>${sel} { color: #112018 !important; }</style>`,
        explanation: `Increased text contrast for '${sel}' to satisfy WCAG 4.5:1 ratio.`,
        changedRegionsHint: ["Added high contrast style"],
      };
    }

    case "AXE-link-in-text-block": {
      if (source.includes("</style>")) {
        return {
          modifiedSource: source.replace("</style>", `  ${sel} { text-decoration: underline !important; }\n</style>`),
          explanation: `Added visible underline to inline link '${sel}' to ensure link status does not rely solely on color.`,
          changedRegionsHint: ["Added text-decoration: underline to inline link"],
        };
      }
      return {
        modifiedSource: source + `\n<style>${sel} { text-decoration: underline !important; }</style>`,
        explanation: `Added visible underline to inline link '${sel}'.`,
        changedRegionsHint: ["Added text-decoration: underline"],
      };
    }

    case "AXE-region":
    case "AXE-landmark-one-main": {
      if (source.includes("<body>") && source.includes("</body>") && !source.includes("<main")) {
        return {
          modifiedSource: source.replace("<body>", "<body>\n<main role=\"main\">").replace("</body>", "</main>\n</body>"),
          explanation: "Wrapped page content inside a semantic <main role='main'> landmark container.",
          changedRegionsHint: ["Wrapped body in main landmark"],
        };
      }
      return {
        modifiedSource: source,
        explanation: "Page content should be enclosed in semantic landmark regions.",
        changedRegionsHint: [],
      };
    }

    default:
      return {
        modifiedSource: source,
        explanation: "No deterministic fix pattern for this finding.",
        changedRegionsHint: [],
      };
  }
}

