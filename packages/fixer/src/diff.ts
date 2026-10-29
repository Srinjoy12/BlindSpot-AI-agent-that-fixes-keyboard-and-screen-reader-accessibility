// diff.ts — Computes unified diffs between original and modified source.
// Uses the 'diff' npm package with 3 lines of context.
// Per rule: never trust a model-written diff; always compute deterministic diffs.

import { createTwoFilesPatch } from "diff";

export interface ComputeDiffOptions {
  filename?: string;
  context?: number;
}

/**
 * Computes a standard unified diff between original and modified code.
 *
 * @param original - The original source code string.
 * @param modified - The modified source code string.
 * @param options - Configuration options (defaults to context: 3).
 * @returns Unified diff string.
 */
export function computeUnifiedDiff(
  original: string,
  modified: string,
  optionsOrFilename: ComputeDiffOptions | string = {}
): string {
  const options =
    typeof optionsOrFilename === "string"
      ? { filename: optionsOrFilename }
      : optionsOrFilename;
  const filename = options.filename ?? "source.html";
  const context = options.context ?? 3;

  // If there are no differences, return empty string
  if (original === modified) {
    return "";
  }

  const patch = createTwoFilesPatch(
    `a/${filename}`,
    `b/${filename}`,
    original,
    modified,
    "original",
    "fixed",
    { context }
  );

  return patch;
}
