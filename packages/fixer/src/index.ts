// packages/fixer index — exports patch application, deterministic verifier, and the fix loop.

export { applyPatch } from "./apply.js";
export { verifyFix } from "./verifier.js";
export type { VerificationResult } from "./verifier.js";
export { runFixLoop } from "./loop.js";
export type { FixLoopResult } from "./loop.js";
