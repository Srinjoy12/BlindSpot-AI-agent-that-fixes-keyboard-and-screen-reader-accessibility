// packages/engine index — public API for the audit engine.

export {
  checkUrl,
  SsrfError,
  isIpBlocked,
  isAllowedFixtureUrl,
  resolveAndCheckHost,
  attachSsrfGuard,
  extractEmbeddedIpv4,
} from "./ssrf.js";
export { startSession } from "./session.js";
export type { Session, SessionOptions } from "./session.js";
export { AuditConcurrencyController, auditConcurrency } from "./concurrency.js";
export { captureAxTree, getInteractiveNodes } from "./axTree.js";
export type { AXNode, AXTreeSnapshot } from "./axTree.js";
export { crawl } from "./crawl.js";
export type { CrawlResult } from "./crawl.js";
export { runInteractionPass } from "./interaction.js";
export type { InteractionPassResult } from "./interaction.js";
export { runAxe, isFindingReportedByAxe, convertAxeRulesToHits } from "./axe.js";
export { loadSource, wrapSnippetHtml, closeSharedBrowser } from "./source.js";
export {
  validateFilePath,
  validateFileSet,
  createFileSetServer,
  loadSourceFileSet,
  auditFileSet,
} from "./fileSet.js";
export type {
  FocusStop,
  FocusIndicator,
  BoundingBox,
  PageState,
  CrawlOptions,
  InteractionRecord,
  AuditSession,
  AxeRuleSummary,
  AxeBaselineResult,
  SourceAuditOptions,
  SourceSession,
  FileSet,
  FileInputItem,
  FileSetAuditOptions,
} from "./types.js";
