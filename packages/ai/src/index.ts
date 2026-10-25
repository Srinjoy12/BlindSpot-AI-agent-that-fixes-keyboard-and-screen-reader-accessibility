// packages/ai index — re-exports everything public from this package.

export { getTokenFactoryClient, Models } from "./client.js";
export { recordCall, getLedger, clearLedger, ledgerTotals } from "./ledger.js";
export type { ModelCallRecord } from "./ledger.js";
export {
  SYSTEM_GUARDRAIL,
  NANO_DIGEST_PROMPT,
  SUPER_ANALYSIS_PROMPT,
  ULTRA_FIX_PROMPT,
} from "./prompts.js";
export {
  StateDigestSchema,
  FindingAnalysisSchema,
  FixProposalSchema,
  SeveritySchema,
  WcagRefSchema,
  PatchTypeSchema,
} from "./schemas.js";
export type { StateDigest, FindingAnalysis, FixProposal, Severity, PatchType } from "./schemas.js";

export { searchWcag } from "./tavily.js";
export type { TavilyResult } from "./tavily.js";
export { generateStateDigest } from "./digest.js";
export type { DigestInput } from "./digest.js";
export { analyzeFindings } from "./analysis.js";
export type { AnalysisInput } from "./analysis.js";
export { generateFix, lintPatch } from "./fix.js";
export type { FixRequest } from "./fix.js";
