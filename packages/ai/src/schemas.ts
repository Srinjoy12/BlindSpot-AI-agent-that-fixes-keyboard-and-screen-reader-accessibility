// Zod schemas for all model inputs and outputs.
// Shared between the AI package and the API layer.

import { z } from "zod";

// ─── State Digest (Nano output) ───────────────────────────────────────────────

export const WidgetSchema = z.object({
  selector: z.string(),
  role: z.string(),
  name: z.string(),
  widgetType: z.enum(["menu", "dialog", "carousel", "tabs", "combobox", "accordion", "other"]),
});

export const StateDigestSchema = z.object({
  pagePurpose: z.string().max(200),
  landmarks: z.array(
    z.object({
      role: z.string(),
      label: z.string(),
    })
  ),
  widgets: z.array(WidgetSchema),
  likelyModals: z.array(z.string()),
  customControls: z.array(z.string()),
});

export type StateDigest = z.infer<typeof StateDigestSchema>;

// ─── Finding Analysis (Super output) ─────────────────────────────────────────

export const SeveritySchema = z.enum(["blocker", "major", "minor"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const WcagRefSchema = z.object({
  id: z.string(), // e.g. "2.1.2"
  name: z.string(),
  level: z.enum(["A", "AA", "AAA"]),
  referenceUrl: z.string().url(),
});

export const FindingAnalysisSchema = z.object({
  detectorId: z.enum(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"]),
  severity: SeveritySchema,
  wcag: WcagRefSchema,
  selector: z.string(),
  stateLabel: z.string(),
  impact: z.string().max(300), // one plain sentence
  confidence: z.number().min(0).max(1),
  mergedFrom: z.array(z.string()).optional(), // IDs of merged duplicate hits
});

export type FindingAnalysis = z.infer<typeof FindingAnalysisSchema>;

// ─── Fix Proposal (Ultra output) ─────────────────────────────────────────────

export const PatchTypeSchema = z.enum(["css", "attribute", "html", "script"]);
export type PatchType = z.infer<typeof PatchTypeSchema>;

export const ReactEquivalentSchema = z.object({
  code: z.string(),
  notes: z.array(z.string()),
  source: z.enum(["deterministic", "model"]),
});

export type ReactEquivalent = z.infer<typeof ReactEquivalentSchema>;

export const FixProposalSchema = z.object({
  patchType: PatchTypeSchema,
  body: z.string(),
  rationale: z.string().max(300),
  targetSelector: z.string().optional(),
  reactEquivalent: ReactEquivalentSchema.optional(),
});

export type FixProposal = z.infer<typeof FixProposalSchema>;

// ─── Repair wrapper (used when first output is invalid JSON) ─────────────────

export const RepairRequestSchema = z.object({
  originalOutput: z.string(),
  errorMessage: z.string(),
  schema: z.string(),
});

// ─── Source Fix Proposal (Ultra output in source mode) ──────────────────────

export const UltraSourceFixOutputSchema = z.object({
  modifiedSource: z.string().optional(),
  targetString: z.string().optional(),
  replacementString: z.string().optional(),
  patchType: z.enum(["css", "attribute", "html", "script", "replace"]).optional(),
  body: z.string().optional(),
  targetSelector: z.string().optional(),
  explanation: z.string(),
  changedRegionsHint: z.array(z.string()).default([]),
});

export type UltraSourceFixOutput = z.infer<typeof UltraSourceFixOutputSchema>;

export const SourceFixResponseSchema = z.object({
  modifiedSource: z.string(),
  explanation: z.string(),
  changedRegionsHint: z.array(z.string()).default([]),
});

export type SourceFixResponse = z.infer<typeof SourceFixResponseSchema>;

