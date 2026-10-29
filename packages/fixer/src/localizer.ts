// localizer.ts — Heuristic candidate file localization for multi-file projects.
// Identifies and ranks the files in a FileSet most likely responsible for an accessibility barrier.
// Shared between benchmark suite, hosted project folder mode, and future integrations.

export interface CandidateFile {
  path: string;
  score: number;
  content: string;
  reasons: string[];
}

export interface LocalizeBarrierInput {
  selector: string;
  detectorId?: string;
  evidence?: string;
  impact?: string;
}

export interface LocalizeOptions {
  maxCandidates?: number; // default: 3
  maxTotalBytes?: number; // default: 60 KB (60 * 1024)
}

/**
 * Extracts distinct identifier tokens from a CSS selector.
 */
function extractTokens(selector: string): {
  ids: string[];
  classes: string[];
  attributes: string[];
  tags: string[];
} {
  const ids: string[] = [];
  const classes: string[] = [];
  const attributes: string[] = [];
  const tags: string[] = [];

  // Match IDs: #foo
  const idMatches = selector.matchAll(/#([a-zA-Z0-9_-]+)/g);
  for (const m of idMatches) {
    if (m[1]) ids.push(m[1]);
  }

  // Match classes: .foo
  const classMatches = selector.matchAll(/\.([a-zA-Z0-9_-]+)/g);
  for (const m of classMatches) {
    if (m[1]) classes.push(m[1]);
  }

  // Match attribute names: [attr] or [attr=val]
  const attrMatches = selector.matchAll(/\[([a-zA-Z0-9_-]+)(?:[~|^$*]?=["']?([^"'\]]+)["']?)?\]/g);
  for (const m of attrMatches) {
    if (m[1]) attributes.push(m[1]);
    if (m[2]) attributes.push(m[2]);
  }

  // Match standard semantic tags
  const tagMatches = selector.matchAll(/\b(button|a|input|select|textarea|dialog|nav|header|footer|main|section|ul|ol|li|details|summary)\b/gi);
  for (const m of tagMatches) {
    if (m[1]) tags.push(m[1].toLowerCase());
  }

  return { ids, classes, attributes, tags };
}

/**
 * Ranks files in a FileSet by relevance to a given accessibility barrier.
 * Scores matches on IDs (+25), classes (+12), attributes (+8), detector affinities, and keywords.
 * Returns up to maxCandidates (default 3) capped at maxTotalBytes (default 60 KB).
 */
export function localizeCandidateFiles(
  barrier: LocalizeBarrierInput,
  fileSet: Map<string, string>,
  options: LocalizeOptions = {}
): CandidateFile[] {
  const maxCandidates = options.maxCandidates ?? 3;
  const maxTotalBytes = options.maxTotalBytes ?? 60 * 1024;

  const selector = barrier.selector || "";
  const detectorId = barrier.detectorId || "";
  const evidence = (barrier.evidence || "").toLowerCase();
  const { ids, classes, attributes, tags } = extractTokens(selector);

  const scoredFiles: CandidateFile[] = [];

  for (const [filePath, content] of fileSet.entries()) {
    let score = 0;
    const reasons: string[] = [];
    const lowerPath = filePath.toLowerCase();
    const isHtml = lowerPath.endsWith(".html") || lowerPath.endsWith(".htm");
    const isCss = lowerPath.endsWith(".css");
    const isJs = lowerPath.endsWith(".js") || lowerPath.endsWith(".mjs") || lowerPath.endsWith(".cjs") || lowerPath.endsWith(".ts");

    // Only inspect web source text files
    if (!isHtml && !isCss && !isJs) {
      continue;
    }

    // 1. Exact ID matches (High confidence)
    for (const id of ids) {
      if (content.includes(`id="${id}"`) || content.includes(`id='${id}'`)) {
        score += 30;
        reasons.push(`Contains id="${id}"`);
      } else if (content.includes(`#${id}`)) {
        score += 25;
        reasons.push(`Contains selector #${id}`);
      } else if (content.includes(`"${id}"`) || content.includes(`'${id}'`)) {
        score += 15;
        reasons.push(`References ID token '${id}'`);
      }
    }

    // 2. Class matches
    for (const cls of classes) {
      if (
        content.includes(`class="${cls}"`) ||
        content.includes(`class='${cls}'`) ||
        content.includes(` ${cls} `) ||
        content.includes(`.${cls}`)
      ) {
        score += 15;
        reasons.push(`Matches class .${cls}`);
      }
    }

    // 3. Attribute matches (e.g. role, tabindex, aria-, onclick)
    for (const attr of attributes) {
      if (content.includes(attr)) {
        score += 8;
        reasons.push(`Matches attribute '${attr}'`);
      }
    }

    // 4. Semantic tag matches
    for (const tag of tags) {
      if (content.includes(`<${tag}`) || content.includes(`${tag}:focus`)) {
        score += 4;
        reasons.push(`Contains tag <${tag}>`);
      }
    }

    // 5. Detector-specific affinity scoring
    switch (detectorId) {
      case "D1": // Keyboard trap
        if (isJs && (content.includes("keydown") || content.includes("keyup") || content.includes("keypress") || content.includes("Tab"))) {
          score += 20;
          reasons.push("JavaScript keyboard event handler for trap");
        }
        if (isHtml && content.includes("dialog")) {
          score += 10;
          reasons.push("HTML dialog component");
        }
        break;

      case "D2": // Missing keyboard trigger / click-only
        if (isJs && (content.includes("addEventListener('click'") || content.includes('addEventListener("click"'))) {
          score += 15;
          reasons.push("JavaScript click handler missing keyboard alternative");
        }
        if (isHtml && (content.includes("onclick=") || content.includes("role=\"button\""))) {
          score += 15;
          reasons.push("HTML element with click-only action");
        }
        break;

      case "D3": // Focus indicator missing (WCAG 2.4.7 — outline: 0 / outline: none)
        if (isCss && (content.includes("outline: 0") || content.includes("outline: none") || content.includes("outline:0") || content.includes(":focus"))) {
          score += 40;
          reasons.push("CSS resets outline or defines focus styling");
        } else if (isCss) {
          score += 15;
          reasons.push("CSS stylesheet");
        }
        if (isHtml && (content.includes("style=\"outline") || content.includes("style='outline"))) {
          score += 25;
          reasons.push("Inline style resets outline");
        }
        break;

      case "D4": // Focus order
        if (isHtml) {
          score += 15;
          reasons.push("HTML document defining DOM focus order");
        }
        break;

      case "D5": // Obscured / sticky
        if (isCss && (content.includes("position: fixed") || content.includes("position: sticky") || content.includes("z-index"))) {
          score += 25;
          reasons.push("CSS sticky or fixed overlay positioning");
        }
        break;

      case "D6": // Missing accessible name
        if (isHtml) {
          score += 20;
          reasons.push("HTML element missing accessible label or aria-label");
        }
        break;

      case "D7": // Positive tabindex
        if (isHtml && content.includes("tabindex=")) {
          score += 25;
          reasons.push("HTML contains positive tabindex");
        }
        break;

      case "D8": // Dialog / modal
        if (isHtml && (content.includes("dialog") || content.includes("modal") || content.includes("role=\"dialog\""))) {
          score += 25;
          reasons.push("HTML dialog markup");
        }
        if (isJs && (content.includes("dialog") || content.includes("showModal"))) {
          score += 20;
          reasons.push("JavaScript modal management");
        }
        break;

      case "D9": // Skip link missing
        if (isHtml && (lowerPath === "index.html" || lowerPath.endsWith("/index.html"))) {
          score += 25;
          reasons.push("Entry HTML document missing skip link");
        }
        break;
    }

    // 6. Evidence keyword matches
    if (evidence.includes("outline") && isCss && content.includes("outline")) {
      score += 10;
    }
    if (evidence.includes("tabindex") && content.includes("tabindex")) {
      score += 10;
    }

    // 7. Base score for entry HTML if no other strong score
    if (lowerPath === "index.html" || lowerPath.endsWith("/index.html")) {
      score += 5;
      reasons.push("Entry HTML document");
    }

    if (score > 0) {
      scoredFiles.push({
        path: filePath,
        score,
        content,
        reasons,
      });
    }
  }

  // Sort descending by score
  scoredFiles.sort((a, b) => b.score - a.score);

  // If nothing scored, fall back to any HTML files or first available files
  if (scoredFiles.length === 0) {
    for (const [filePath, content] of fileSet.entries()) {
      const lower = filePath.toLowerCase();
      if (lower.endsWith(".html") || lower.endsWith(".htm") || lower.endsWith(".css") || lower.endsWith(".js")) {
        scoredFiles.push({
          path: filePath,
          score: 1,
          content,
          reasons: ["Fallback candidate"],
        });
      }
    }
  }

  // Pick top N candidates within size budget
  const selected: CandidateFile[] = [];
  let currentBytes = 0;

  for (const candidate of scoredFiles) {
    if (selected.length >= maxCandidates) break;
    const fileBytes = Buffer.byteLength(candidate.content, "utf8");

    if (currentBytes + fileBytes <= maxTotalBytes || selected.length === 0) {
      selected.push(candidate);
      currentBytes += fileBytes;
    }
  }

  return selected;
}
