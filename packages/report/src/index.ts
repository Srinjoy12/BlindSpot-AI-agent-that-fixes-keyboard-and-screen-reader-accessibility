// packages/report index — exports types and generators for Markdown, HTML, and JSON reports.

export * from "./types.js";
export { generateMarkdownReport } from "./markdown.js";
export { generateHtmlReport } from "./html.js";
export { ReportStore, type ReportStoreOptions, type StoredReport } from "./store.js";
