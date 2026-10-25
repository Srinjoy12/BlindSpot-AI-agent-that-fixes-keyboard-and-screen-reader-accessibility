// types.ts — Types and schemas for BlindSpot audit reports.

import { z } from "zod";
import { FindingAnalysisSchema, FixProposalSchema } from "@blindspot/ai";

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
});

export type BarrierReportItem = z.infer<typeof BarrierReportItemSchema>;

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
  }),
  barriers: z.array(BarrierReportItemSchema),
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
});

export type AuditReport = z.infer<typeof AuditReportSchema>;
