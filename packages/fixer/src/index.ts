// packages/fixer index — exports patch application, deterministic verifier, and the fix loop.

export { applyPatch } from "./apply.js";
export { verifyFix } from "./verifier.js";
export type { VerificationResult } from "./verifier.js";
export { runFixLoop } from "./loop.js";
export type { FixLoopResult } from "./loop.js";

// Source mode exports for pasted code and unified diffs
export { computeUnifiedDiff } from "./diff.js";
export { lintDiff } from "./diffLinter.js";
export type { DiffLintResult } from "./diffLinter.js";
export { verifySourceFix } from "./sourceVerifier.js";
export type { SourceVerificationResult } from "./sourceVerifier.js";
export { fixSingleSourceFinding, runSourceFixLoop } from "./sourceLoop.js";
export type { SourceFixResult, FixSourceOptions, RunSourceFixLoopResult } from "./sourceLoop.js";

// FileSet / folder mode exports
export { localizeCandidateFiles } from "./localizer.js";
export type { CandidateFile, LocalizeBarrierInput, LocalizeOptions } from "./localizer.js";
export { verifyFileSetFix } from "./fileSetVerifier.js";
export { runFileSetFixLoop } from "./fileSetLoop.js";
export type {
  FileSetEdit,
  RunFileSetFixLoopOptions,
  RunFileSetFixLoopResult,
} from "./fileSetLoop.js";

// React JSX/TSX deterministic translator
export { translateFixToReact } from "./reactTranslate.js";
export type { FixTranslationInput, TranslationContext } from "./reactTranslate.js";

