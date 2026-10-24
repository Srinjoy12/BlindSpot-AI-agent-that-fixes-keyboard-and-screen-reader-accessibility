// Types for the audit engine — focus stops, page states, accessibility tree.
// Shared between engine, detectors, and the API layer.

import { z } from "zod";

// ─── Focus Indicator ──────────────────────────────────────────────────────────

export const FocusIndicatorSchema = z.object({
  hasOutline: z.boolean(),
  hasBoxShadow: z.boolean(),
  hasBorderChange: z.boolean(),
  hasBackgroundChange: z.boolean(),
  outlineWidth: z.number().optional(),
  outlineColor: z.string().optional(),
  contrastRatio: z.number().optional(), // if measurable
});

export type FocusIndicator = z.infer<typeof FocusIndicatorSchema>;

// ─── Bounding Box ─────────────────────────────────────────────────────────────

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

// ─── Focus Stop ───────────────────────────────────────────────────────────────

export const FocusStopSchema = z.object({
  index: z.number(),
  direction: z.enum(["forward", "backward"]),
  selector: z.string(),
  tagName: z.string(),
  role: z.string(),
  accessibleName: z.string(),
  box: BoundingBoxSchema,
  inViewport: z.boolean(),
  obscuredBy: z.string().nullable(), // selector of covering element, or null
  focusIndicator: FocusIndicatorSchema,
  insideOpenDialog: z.boolean(),
  scrollY: z.number(),
  // For cycle detection
  elementHandle: z.string().optional(), // internal, not serialized
});

export type FocusStop = z.infer<typeof FocusStopSchema>;

// ─── Page State ───────────────────────────────────────────────────────────────

export const PageStateSchema = z.object({
  label: z.string(), // S0, S1, S2 …
  triggeredBy: z.string().optional(), // selector that opened this state
  axTreeSnapshot: z.record(z.unknown()), // raw accessibility tree from CDP
  focusStops: z.array(FocusStopSchema),
  screenshotRef: z.string().optional(), // path to saved screenshot
  url: z.string(),
  timestamp: z.string(),
});

export type PageState = z.infer<typeof PageStateSchema>;

// ─── Crawl Options ────────────────────────────────────────────────────────────

export interface CrawlOptions {
  maxStops?: number; // default: 150
  backwardStops?: number; // default: 40
  pauseMs?: number; // default: 80ms between tabs
}

// ─── Interaction Record ───────────────────────────────────────────────────────

export const InteractionRecordSchema = z.object({
  triggerSelector: z.string(),
  triggerKey: z.enum(["Enter", "Space"]),
  openedState: z.string().optional(), // state label of the opened surface
  escapeClosed: z.boolean(),
  focusReturnedToTrigger: z.boolean(),
  focusMovedIntoSurface: z.boolean(),
  focusLostAfterClose: z.boolean(),
});

export type InteractionRecord = z.infer<typeof InteractionRecordSchema>;

// ─── Audit Session ────────────────────────────────────────────────────────────

export interface AuditSession {
  auditId: string;
  targetUrl: string;
  states: PageState[];
  interactions: InteractionRecord[];
  limitsHit: string[]; // e.g. ["maxStops", "timeout"]
  startedAt: string;
  finishedAt?: string;
}
