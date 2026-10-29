// reactLocalizer.ts — Heuristic candidate file localization for React (JSX/TSX) projects.
// Identifies and ranks .tsx, .jsx, and .css/.scss files most likely responsible for an accessibility barrier.
// Deterministic regex/string scanning only; zero new dependencies.

export interface ReactCandidateFile {
  path: string;
  score: number;
  content: string;
  confidence: "high" | "low";
  matchedSignals: string[];
}

export interface LocalizeReactBarrierInput {
  selector: string;
  detectorId?: string;
  evidence?: string;
  impact?: string;
}

export interface LocalizeReactOptions {
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
  const tagMatches = selector.matchAll(
    /\b(button|a|input|select|textarea|dialog|nav|header|footer|main|section|ul|ol|li|details|summary|form|aside)\b/gi
  );
  for (const m of tagMatches) {
    if (m[1]) tags.push(m[1].toLowerCase());
  }

  return { ids, classes, attributes, tags };
}

/**
 * Checks if a string contains computed or dynamic className expressions
 * referencing a given class token (e.g. `styles[cls]`, `clsx(..., cls)`, `${cls}`).
 */
function containsComputedClass(content: string, cls: string): boolean {
  // Check template literal usage: `${...cls...}`
  const templateRegex = new RegExp(`\\$\\{[^}]*\\b${cls}\\b[^}]*\\}`);
  if (templateRegex.test(content)) return true;

  // Check helper calls: clsx(..., 'cls') or classNames(..., 'cls') or cn(..., 'cls')
  const helperRegex = new RegExp(`\\b(clsx|classNames|cn|cva)\\s*\\([^)]*\\b${cls}\\b[^)]*\\)`);
  if (helperRegex.test(content)) return true;

  // Check dynamic property access: styles[cls] or classes[cls]
  const bracketRegex = new RegExp(`\\b(styles|classes|cx)\\[['"]?${cls}['"]?\\]`);
  if (bracketRegex.test(content)) return true;

  return false;
}

/**
 * Scores and ranks candidate files in a React FileSet against an accessibility barrier.
 * Signals:
 * - id="x" / id={"x"} (+30)
 * - #x (+25)
 * - className strings & styles.x (+15)
 * - aria-label / role / tabIndex / data-testid (+8)
 * - tag / component name (+4)
 * - detector affinity (+20: D3/D5 -> CSS, D1/D8/D2 -> TSX/JSX)
 * - computed classNames get partial credit (+7) and confidence: "low"
 *
 * Returns up to maxCandidates (default 3), capped at maxTotalBytes (default 60 KB).
 */
export function localizeReactCandidateFiles(
  barrier: LocalizeReactBarrierInput,
  fileSet: Map<string, string>,
  options: LocalizeReactOptions = {}
): ReactCandidateFile[] {
  const maxCandidates = options.maxCandidates ?? 3;
  const maxTotalBytes = options.maxTotalBytes ?? 60 * 1024;

  const selector = barrier.selector || "";
  const detectorId = barrier.detectorId || "";
  const { ids, classes, attributes, tags } = extractTokens(selector);

  const scoredFiles: ReactCandidateFile[] = [];

  for (const [filePath, content] of fileSet.entries()) {
    let score = 0;
    const matchedSignals: string[] = [];
    let hasHighConfidenceSignal = false;
    let hasComputedClassOnly = false;

    const lowerPath = filePath.toLowerCase();
    const isTsxOrJsx = lowerPath.endsWith(".tsx") || lowerPath.endsWith(".jsx");
    const isCss =
      lowerPath.endsWith(".css") ||
      lowerPath.endsWith(".scss") ||
      lowerPath.endsWith(".sass") ||
      lowerPath.endsWith(".less");
    const isTsOrJs =
      lowerPath.endsWith(".ts") ||
      lowerPath.endsWith(".js") ||
      lowerPath.endsWith(".mjs");
    const isHtml = lowerPath.endsWith(".html") || lowerPath.endsWith(".htm");

    // Only inspect source code files
    if (!isTsxOrJsx && !isCss && !isTsOrJs && !isHtml) {
      continue;
    }

    // 1. ID matches: id="x" / id={'x'} / id={"x"} (+30), #x (+25)
    for (const id of ids) {
      const directIdRegex = new RegExp(`id\\s*=\\s*[{'"]${id}['"}]`);
      if (
        directIdRegex.test(content) ||
        content.includes(`id="${id}"`) ||
        content.includes(`id='${id}'`) ||
        content.includes(`id={"${id}"}`) ||
        content.includes(`id={'${id}'}`)
      ) {
        score += 30;
        matchedSignals.push(`Contains id="${id}" or id={"${id}"}`);
        hasHighConfidenceSignal = true;
      } else if (content.includes(`#${id}`)) {
        score += 25;
        matchedSignals.push(`Contains selector #${id}`);
        hasHighConfidenceSignal = true;
      } else if (content.includes(`"${id}"`) || content.includes(`'${id}'`)) {
        score += 10;
        matchedSignals.push(`References ID token '${id}'`);
      }
    }

    // 2. ClassName & CSS matches (+15 direct, +7 computed)
    for (const cls of classes) {
      let matchedCls = false;

      // JSX className strings: className="... cls ..." or className={'... cls ...'}
      if (
        content.includes(`className="${cls}"`) ||
        content.includes(`className='${cls}'`) ||
        content.includes(`className={"${cls}"}`) ||
        content.includes(`className={'${cls}'}`) ||
        new RegExp(`className\\s*=\\s*["'\`][^"'\`]*\\b${cls}\\b[^"'\`]*["'\`]`).test(content)
      ) {
        score += 15;
        matchedSignals.push(`Matches className string '${cls}'`);
        hasHighConfidenceSignal = true;
        matchedCls = true;
      }

      // CSS / SCSS stylesheet matches (.cls)
      if (isCss && (content.includes(`.${cls}`) || content.includes(`&.${cls}`))) {
        score += 15;
        matchedSignals.push(`Matches CSS selector .${cls}`);
        hasHighConfidenceSignal = true;
        matchedCls = true;
      }

      // CSS modules: styles.cls or styles['cls']
      if (
        content.includes(`styles.${cls}`) ||
        content.includes(`styles["${cls}"]`) ||
        content.includes(`styles['${cls}']`)
      ) {
        score += 15;
        matchedSignals.push(`Matches CSS module styles.${cls}`);
        hasHighConfidenceSignal = true;
        matchedCls = true;
      }

      // Computed classNames (+7 partial credit)
      if (!matchedCls && containsComputedClass(content, cls)) {
        score += 7;
        matchedSignals.push(`Matches computed/dynamic className '${cls}'`);
        hasComputedClassOnly = true;
      }
    }

    // 3. Accessibility attribute matches: aria-label / role / tabIndex / data-testid (+8)
    const standardAttrs = ["aria-label", "role", "tabindex", "tabIndex", "data-testid", "aria-expanded", "aria-hidden", "aria-modal"];
    for (const attr of [...attributes, ...standardAttrs]) {
      const lowerAttr = attr.toLowerCase();
      if (selector.toLowerCase().includes(lowerAttr)) {
        // Look for JSX attribute in content: tabIndex, role, aria-label, data-testid
        const hasAttr =
          content.includes(attr) ||
          content.includes(lowerAttr) ||
          (lowerAttr === "tabindex" && content.includes("tabIndex"));
        if (hasAttr && !matchedSignals.some((s) => s.includes(`Matches attribute '${attr}'`))) {
          score += 8;
          matchedSignals.push(`Matches attribute '${attr}'`);
        }
      }
    }

    // 4. Semantic tag / component name (+4)
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      const tagPascal = tag.charAt(0).toUpperCase() + tag.slice(1);
      if (
        content.includes(`<${tagLower}`) ||
        content.includes(`<${tagPascal}`) ||
        content.includes(`${tagLower}:focus`)
      ) {
        score += 4;
        matchedSignals.push(`Contains tag or component <${tag}>`);
        break; // Count once per file
      }
    }

    // 5. Detector-specific affinity (+20)
    // Apply affinity boost only if there is already a matching signal in the file
    if (score > 0) {
      // D3 (Focus indicator missing) / D5 (Obscured / sticky) -> CSS affinity
      if ((detectorId === "D3" || detectorId === "D5") && isCss) {
        score += 20;
        matchedSignals.push(`Detector affinity: CSS for focus outline / sticky positioning (${detectorId})`);
      }

      // D1 (Keyboard trap) / D8 (Focus not returned) / D2 (Unreachable control) -> TSX/JSX affinity
      if ((detectorId === "D1" || detectorId === "D8" || detectorId === "D2") && isTsxOrJsx) {
        score += 20;
        matchedSignals.push(`Detector affinity: TSX/JSX for interactive keyboard logic (${detectorId})`);
      }
    }

    if (score > 0) {
      // Determine confidence: "high" if direct ID/class match or score >= 25 without computed-only
      const confidence: "high" | "low" =
        hasHighConfidenceSignal || (score >= 25 && !hasComputedClassOnly)
          ? "high"
          : "low";

      scoredFiles.push({
        path: filePath,
        score,
        content,
        confidence,
        matchedSignals,
      });
    }
  }

  // Sort descending by score, then tiebreak by path
  scoredFiles.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  // Cap at maxCandidates and maxTotalBytes (60 KB)
  const results: ReactCandidateFile[] = [];
  let totalBytes = 0;

  for (const file of scoredFiles) {
    if (results.length >= maxCandidates) break;
    const fileBytes = Buffer.byteLength(file.content, "utf8");
    if (totalBytes + fileBytes <= maxTotalBytes || results.length === 0) {
      results.push(file);
      totalBytes += fileBytes;
    }
  }

  return results;
}
