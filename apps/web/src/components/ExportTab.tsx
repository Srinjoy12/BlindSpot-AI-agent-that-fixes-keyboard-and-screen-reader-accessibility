import React, { useState } from "react";
import { generateHtmlReport, generateMarkdownReport, type AuditReport } from "@blindspot/report";
import { Button } from "./ui/Button.js";
import { StatusIcon } from "./ui/StatusIcon.js";

interface ExportTabProps {
  auditId: string | null;
  report?: AuditReport | null;
}

export const ExportTab: React.FC<ExportTabProps> = ({ auditId, report }) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  if (!auditId && !report) {
    return (
      <div
        style={{
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-6)",
          textAlign: "center",
          color: "var(--color-text-secondary)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        No audit report loaded. Run a scan to export deliverables.
      </div>
    );
  }

  const safeId = (report?.auditId || auditId || "audit").replace(/[^a-zA-Z0-9_-]/g, "_");

  const triggerClientDownload = (format: "html" | "markdown" | "json", e?: React.MouseEvent) => {
    if (!report) return;

    try {
      setDownloadingFormat(format);
      let content = "";
      let mimeType = "";
      let filename = "";

      if (format === "html") {
        content = generateHtmlReport(report);
        mimeType = "text/html;charset=utf-8";
        filename = `blindspot-report-${safeId}.html`;
      } else if (format === "markdown") {
        content = generateMarkdownReport(report);
        mimeType = "text/markdown;charset=utf-8";
        filename = `blindspot-report-${safeId}.md`;
      } else {
        content = JSON.stringify(report, null, 2);
        mimeType = "application/json;charset=utf-8";
        filename = `blindspot-report-${safeId}.json`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      e?.preventDefault();
    } catch (err) {
      console.warn("Client blob generation fallback error:", err);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 1000);
    }
  };

  const handleCopySummary = () => {
    if (!report) return;

    const barriers = report.barriers || [];
    const blockers = barriers.filter((b: any) => b.severity === "blocker").length;
    const majors = barriers.filter((b: any) => b.severity === "major").length;
    const minors = barriers.filter((b: any) => b.severity === "minor").length;
    const fixesTested = barriers.filter((b: any) => b.status === "verified" || b.verified).length;
    const axeCount = report.baseline?.violationCount ?? 0;
    const foundOnly = barriers.filter((b: any) => !b.alsoReportedByAxe).length;

    const summaryText = [
      `BlindSpot Keyboard Audit Summary`,
      `Target: ${report.targetUrl || "Source code snippet"}`,
      `Time taken: ${((report.durationMs || 0) / 1000).toFixed(1)}s`,
      `Tab stops: ${report.summary?.totalStops ?? 0}`,
      ``,
      `Problems found: ${barriers.length}`,
      `- Blocks keyboard use: ${blockers}`,
      `- Hard to use: ${majors}`,
      `- Minor: ${minors}`,
      `Fixes tested: ${fixesTested} of ${barriers.length}`,
      ``,
      `axe-core comparison: axe-core found ${axeCount} static issues; BlindSpot found ${foundOnly} runtime issues that require keyboard testing to discover.`,
      ``,
      `Built with Nebius Token Factory and NVIDIA Nemotron`,
    ].join("\n");

    navigator.clipboard.writeText(summaryText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Export deliverables
          </h2>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              marginTop: "2px",
            }}
          >
            Export deterministic test results, WCAG citations, and verified patches
          </div>
        </div>

        {/* Copy Summary Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopySummary}
          title="Copy plain-text audit summary to clipboard"
        >
          {copySuccess ? "✓ Summary copied" : "Copy summary"}
        </Button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {/* HTML Report Card */}
        <div
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "4px",
              }}
            >
              HTML report
            </div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              Standalone, self-contained accessible HTML document with interactive focus scrubber and complete diffs.
            </div>
          </div>

          <a
            href={auditId ? `/api/reports/${auditId}/html` : "#"}
            download={`blindspot-report-${safeId}.html`}
            onClick={(e) => triggerClientDownload("html", e)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-border-ui)",
              color: "var(--color-text-primary)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 600,
              textDecoration: "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {downloadingFormat === "html" ? "Generating..." : "Download HTML (.html) ↓"}
          </a>
        </div>

        {/* Markdown Document Card */}
        <div
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "4px",
              }}
            >
              Markdown summary
            </div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              GitHub-ready markdown document detailing discovered barriers, WCAG references, and code patches.
            </div>
          </div>

          <a
            href={auditId ? `/api/reports/${auditId}/markdown` : "#"}
            download={`blindspot-report-${safeId}.md`}
            onClick={(e) => triggerClientDownload("markdown", e)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-border-subdued)",
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              textDecoration: "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {downloadingFormat === "markdown" ? "Generating..." : "Download Markdown (.md) ↓"}
          </a>
        </div>

        {/* JSON Schema Card */}
        <div
          style={{
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "var(--font-size-base)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: "4px",
              }}
            >
              JSON schema
            </div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              Complete programmatic data payload matching the BlindSpot AuditReport TypeScript schema.
            </div>
          </div>

          <a
            href={auditId ? `/api/reports/${auditId}/json` : "#"}
            download={`blindspot-report-${safeId}.json`}
            onClick={(e) => triggerClientDownload("json", e)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-border-subdued)",
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              textDecoration: "none",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {downloadingFormat === "json" ? "Generating..." : "Download JSON (.json) ↓"}
          </a>
        </div>
      </div>
    </div>
  );
};
