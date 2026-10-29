import { z } from "zod";
import { FindingAnalysisSchema, FixProposalSchema } from "@blindspot/ai";
export const AxeRuleSummarySchema = z.object({
  id: z.string(),
  impact: z.string().nullable().optional(),
  tags: z.array(z.string()),
  nodesCount: z.number(),
  selectors: z.array(z.string()),
});

export const AxeBaselineResultSchema = z.object({
  tool: z.literal("axe-core"),
  version: z.string(),
  violationCount: z.number(),
  rules: z.array(AxeRuleSummarySchema),
});

export const BarrierReportItemSchema = z.object({
  id: z.string(),
  detectorId: z.string(),
  severity: z.enum(["blocker", "major", "minor"]),
  selector: z.string(),
  wcagId: z.string(),
  wcagName: z.string(),
  wcagUrl: z.string(),
  impact: z.string(),
  evidence: z.string(),
  fix: FixProposalSchema.optional(),
  verified: z.boolean(),
  verificationEvidence: z.string().optional(),
  alsoReportedByAxe: z.boolean().optional(),
});

export type BarrierReportItem = z.infer<typeof BarrierReportItemSchema>;

export const StageTimingsSchema = z.object({
  crawlMs: z.number(),
  axeMs: z.number(),
  modelsMs: z.number(),
  verificationMs: z.number(),
  totalMs: z.number(),
});
export type StageTimings = z.infer<typeof StageTimingsSchema>;

export const TierModelsAndCostSchema = z.object({
  tier: z.enum(["Nano", "Super", "Ultra"]),
  job: z.string(),
  modelId: z.string(),
  calls: z.number(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  totalTokens: z.number(),
  totalLatencyMs: z.number(),
  meanLatencyMs: z.number(),
  estimatedCostUsd: z.number().nullable(),
  outcomes: z.record(z.string(), z.number()).optional(),
});
export type TierModelsAndCost = z.infer<typeof TierModelsAndCostSchema>;

export const ModelsAndCostSchema = z.object({
  tiers: z.object({
    nano: TierModelsAndCostSchema,
    super: TierModelsAndCostSchema,
    ultra: TierModelsAndCostSchema,
  }),
  tavily: z
    .object({
      calls: z.number(),
      totalLatencyMs: z.number(),
      meanLatencyMs: z.number(),
    })
    .optional(),
  totalCalls: z.number(),
  totalTokensIn: z.number(),
  totalTokensOut: z.number(),
  totalTokens: z.number(),
  totalLatencyMs: z.number(),
  totalEstimatedCostUsd: z.number().nullable(),
  estimatedCostPerVerifiedFixUsd: z.number().nullable(),
  wallClockDurationMs: z.number(),
  stageTimeline: StageTimingsSchema.optional(),
});
export type ModelsAndCost = z.infer<typeof ModelsAndCostSchema>;

export const AuditReportSchema = z.object({
  auditId: z.string(),
  targetUrl: z.string(),
  timestamp: z.string(),
  durationMs: z.number(),
  keyboardScore: z.number().min(0).max(100),
  summary: z.object({
    totalStops: z.number(),
    barriersFound: z.number(),
    blockers: z.number(),
    majors: z.number(),
    minors: z.number(),
    fixesVerified: z.number(),
    axeViolations: z.number().optional(),
    foundOnlyByBlindspot: z.number().optional(),
    blockedResourcesCount: z.number().optional(),
  }),
  barriers: z.array(BarrierReportItemSchema),
  baseline: AxeBaselineResultSchema.optional(),
  aiTransparency: z.object({
    totalCalls: z.number(),
    totalTokensIn: z.number(),
    totalTokensOut: z.number(),
    totalLatencyMs: z.number(),
    tiers: z.object({
      nano: z.object({ calls: z.number(), tokens: z.number() }),
      super: z.object({ calls: z.number(), tokens: z.number() }),
      ultra: z.object({ calls: z.number(), tokens: z.number() }),
    }),
    tavilyQueries: z.array(z.string()),
  }),
  modelsAndCost: ModelsAndCostSchema.optional(),
});

export type AuditReport = z.infer<typeof AuditReportSchema>;
