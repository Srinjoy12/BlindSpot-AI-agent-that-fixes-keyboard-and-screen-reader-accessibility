import React, { useState } from "react";
import { generateHtmlReport, generateMarkdownReport, type AuditReport } from "@blindspot/report";

interface ExportBarProps {
  auditId: string | null;
  report?: AuditReport | null;
}

export const ExportBar: React.FC<ExportBarProps> = ({ auditId, report }) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  if (!auditId) return null;

  const safeId = (report?.auditId || auditId).replace(/[^a-zA-Z0-9_-]/g, "_");

  const triggerClientDownload = (format: "html" | "markdown" | "json", e: React.MouseEvent) => {
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
      e.preventDefault();
    } catch (err) {
      console.warn("Client blob generation fallback error, deferring to server link:", err);
    } finally {
      setTimeout(() => setDownloadingFormat(null), 1000);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "var(--space-3)",
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-6)",
      }}
    >
      <div>
        <h2
          style={{
            fontSize: "var(--font-size-base)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Audit deliverables
        </h2>
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginTop: "2px" }}>
          Export deterministic test results, WCAG citations, and verified patches
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {/* HTML Report */}
        <a
          href={`/api/reports/${auditId}/html`}
          download={`blindspot-report-${safeId}.html`}
          onClick={(e) => triggerClientDownload("html", e)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-ui)",
            color: "var(--color-text-primary)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            textDecoration: "none",
            minHeight: "36px",
            cursor: "pointer",
          }}
          title="Download standalone, accessible HTML report (.html)"
        >
          {downloadingFormat === "html" ? "Generating..." : "HTML report (.html) ↓"}
        </a>

        {/* Markdown */}
        <a
          href={`/api/reports/${auditId}/markdown`}
          download={`blindspot-report-${safeId}.md`}
          onClick={(e) => triggerClientDownload("markdown", e)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 400,
            textDecoration: "none",
            minHeight: "36px",
            cursor: "pointer",
          }}
          title="Download Markdown summary document (.md)"
        >
          {downloadingFormat === "markdown" ? "Generating..." : "Markdown summary (.md) ↓"}
        </a>

        {/* JSON */}
        <a
          href={`/api/reports/${auditId}/json`}
          download={`blindspot-report-${safeId}.json`}
          onClick={(e) => triggerClientDownload("json", e)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
            fontWeight: 400,
            textDecoration: "none",
            minHeight: "36px",
            cursor: "pointer",
          }}
          title="Download JSON data schema (.json)"
        >
          {downloadingFormat === "json" ? "Generating..." : "JSON schema (.json) ↓"}
        </a>
      </div>
    </div>
  );
};
