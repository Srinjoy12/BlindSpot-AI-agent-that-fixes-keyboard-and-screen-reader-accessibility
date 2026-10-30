import React, { useState } from "react";
import { generateHtmlReport, generateMarkdownReport, type AuditReport } from "@blindspot/report";
import { Button } from "./ui/Button.js";

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
        className="neo-extruded"
        style={{
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-8)",
          textAlign: "center",
          color: "var(--color-text-secondary)",
          fontSize: "var(--font-size-base)",
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
    } catch (err) {
      console.error(`Failed to generate ${format} report on client:`, err);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 1000);
    }
  };

  const handleCopySummary = () => {
    if (!report) return;

    const barriers = report.barriers || [];
    const blockers = barriers.filter((b) => b.severity === "blocker").length;
    const majors = barriers.filter((b) => b.severity === "major").length;
    const minors = barriers.filter((b) => b.severity === "minor").length;
    const verified = barriers.filter((b) => b.verified || b.status === "verified").length;

    const summaryText = [
      `BlindSpot Accessibility Audit Summary`,
      `Target: ${report.targetUrl}`,
      `Total problems: ${barriers.length}`,
      `  - Blocks keyboard use: ${blockers}`,
      `  - Hard to use: ${majors}`,
      `  - Minor warnings: ${minors}`,
      `Verified fixes: ${verified} of ${barriers.length}`,
      `Time taken: ${((report.durationMs || 0) / 1000).toFixed(1)}s`,
      `Built with Nebius Token Factory and NVIDIA Nemotron`,
    ].join("\n");

    navigator.clipboard.writeText(summaryText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div
      className="neo-extruded"
      style={{
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
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
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "var(--font-size-xl)",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {/* HTML Report Card */}
        <div
          className="neo-extruded"
          style={{
            borderRadius: "var(--radius-lg)",
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

          <Button
            variant="primary"
            size="sm"
            onClick={(e) => triggerClientDownload("html", e)}
            disabled={downloadingFormat === "html"}
          >
            {downloadingFormat === "html" ? "Generating..." : "Download HTML (.html)"}
          </Button>
        </div>

        {/* Markdown Report Card */}
        <div
          className="neo-extruded"
          style={{
            borderRadius: "var(--radius-lg)",
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
              Markdown report
            </div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              Clean GitHub-compatible Markdown document formatted for pull requests and issue trackers.
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => triggerClientDownload("markdown", e)}
            disabled={downloadingFormat === "markdown"}
          >
            {downloadingFormat === "markdown" ? "Generating..." : "Download Markdown (.md)"}
          </Button>
        </div>

        {/* Machine-Readable JSON Card */}
        <div
          className="neo-extruded"
          style={{
            borderRadius: "var(--radius-lg)",
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
              JSON archive
            </div>
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.4,
              }}
            >
              Raw audit payload, step-by-step keyboard stops, AI token ledger, and verified patches.
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => triggerClientDownload("json", e)}
            disabled={downloadingFormat === "json"}
          >
            {downloadingFormat === "json" ? "Generating..." : "Download JSON (.json)"}
          </Button>
        </div>
      </div>
    </div>
  );
};
