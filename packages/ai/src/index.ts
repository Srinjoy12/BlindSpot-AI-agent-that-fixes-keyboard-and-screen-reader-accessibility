// packages/ai index — re-exports everything public from this package.

export { getTokenFactoryClient, Models } from "./client.js";
export {
  recordCall,
  recordTavilyCall,
  getLedger,
  getTavilyLedger,
  clearLedger,
  ledgerTotals,
  aggregateLedger,
} from "./ledger.js";
export type {
  ModelCallRecord,
  TavilyCallRecord,
  ModelStage,
  ModelTier,
  ModelOutcome,
  TierSummary,
  LedgerAggregate,
} from "./ledger.js";
export {
  MODEL_PRICING_TABLE,
  getModelPricing,
  estimateModelCost,
  calculateCostPerVerifiedFix,
} from "./pricing.js";
export type { ModelPricing } from "./pricing.js";
export {
  SYSTEM_GUARDRAIL,
  NANO_DIGEST_PROMPT,
  SUPER_ANALYSIS_PROMPT,
  ULTRA_FIX_PROMPT,
  ULTRA_SOURCE_FIX_PROMPT,
} from "./prompts.js";
export {
  StateDigestSchema,
  FindingAnalysisSchema,
  FixProposalSchema,
  SourceFixResponseSchema,
  SeveritySchema,
  WcagRefSchema,
  PatchTypeSchema,
} from "./schemas.js";
export type {
  StateDigest,
  FindingAnalysis,
  FixProposal,
  SourceFixResponse,
  Severity,
  PatchType,
} from "./schemas.js";

export { searchWcag } from "./tavily.js";
export type { TavilyResult } from "./tavily.js";
export { generateStateDigest } from "./digest.js";
export type { DigestInput } from "./digest.js";
export { analyzeFindings } from "./analysis.js";
export type { AnalysisInput } from "./analysis.js";
export {
  generateFix,
  lintPatch,
  generateSourceFix,
  generateDeterministicSourceFix,
  applySurgicalPatchToSource,
  extractContextForSelector,
} from "./fix.js";
export type { FixRequest, SourceFixRequest } from "./fix.js";
