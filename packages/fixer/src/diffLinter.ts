// diffLinter.ts — Security & Scope Linter for unified diffs.
// Lints ONLY added lines in the diff (pre-existing code belongs to user and is untouched).
// Rejects dangerous network calls, storage APIs, evals, and oversized diffs (>40% lines or >3 regions).

export interface DiffLintResult {
  valid: boolean;
  reason?: string;
  isSecurityViolation?: boolean;
  isSizeViolation?: boolean;
  addedLinesCount: number;
  deletedLinesCount: number;
  regionsCount: number;
}

const FORBIDDEN_ADDED_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "fetch", regex: /\bfetch\s*\(/i },
  { name: "XMLHttpRequest", regex: /XMLHttpRequest/i },
  { name: "WebSocket", regex: /WebSocket/i },
  { name: "eval", regex: /\beval\s*\(/i },
  { name: "new Function", regex: /\bnew\s+Function\s*\(/i },
  { name: "dynamic import()", regex: /\bimport\s*\(/i },
  { name: "http:// or https:// URL", regex: /https?:\/\//i },
  { name: "document.cookie", regex: /document\.cookie/i },
  { name: "localStorage", regex: /localStorage/i },
  { name: "sessionStorage", regex: /sessionStorage/i },
];

/**
 * Validates a unified diff against security policies and size constraints.
 *
 * @param diff - The unified diff string (produced by diff package).
 * @param originalSource - The original source code before modification.
 */
export function lintDiff(diff: string, originalSource: string): DiffLintResult {
  const diffLines = diff.split(/\r?\n/);
  const originalLines = originalSource.split(/\r?\n/).length;

  let addedLinesCount = 0;
  let deletedLinesCount = 0;
  let regionsCount = 0;

  for (const line of diffLines) {
    if (line.startsWith("@@")) {
      regionsCount++;
      continue;
    }

    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("+")) {
      addedLinesCount++;
      const addedContent = line.slice(1);

      // Check security on the added content
      for (const { name, regex } of FORBIDDEN_ADDED_PATTERNS) {
        if (regex.test(addedContent)) {
          return {
            valid: false,
            reason: `Patch violates security policy: added code contains forbidden '${name}'.`,
            isSecurityViolation: true,
            addedLinesCount,
            deletedLinesCount,
            regionsCount,
          };
        }
      }
    } else if (line.startsWith("-")) {
      deletedLinesCount++;
    }
  }

  // 1. Changed lines > 40% of original file (for documents with >5 lines)
  const changedLinesCount = addedLinesCount + deletedLinesCount;
  if (originalLines > 5 && changedLinesCount > 0.4 * originalLines) {
    return {
      valid: false,
      reason: "fix too large, not applied",
      isSizeViolation: true,
      addedLinesCount,
      deletedLinesCount,
      regionsCount,
    };
  }

  // 2. More than 3 regions changed per finding
  if (regionsCount > 3) {
    return {
      valid: false,
      reason: "fix too large, not applied",
      isSizeViolation: true,
      addedLinesCount,
      deletedLinesCount,
      regionsCount,
    };
  }

  return {
    valid: true,
    addedLinesCount,
    deletedLinesCount,
    regionsCount,
  };
}
