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
    if (!report) return; // Allow natural fallback to server href

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
        gap: "12px",
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 20px",
        marginBottom: "20px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Audit Deliverables
        </div>
        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
          Export deterministic test results, WCAG citations, and verified patches for CI review
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {/* HTML Report */}
        <a
          href={`/api/reports/${auditId}/html`}
          download={`blindspot-report-${safeId}.html`}
          onClick={(e) => triggerClientDownload("html", e)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--color-accent-emerald-subtle)",
            border: "1px solid var(--color-accent-emerald-border)",
            color: "var(--color-accent-emerald)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            textDecoration: "none",
            cursor: "pointer",
          }}
          title="Download standalone, accessible HTML report (.html)"
        >
          {downloadingFormat === "html" ? "Generating..." : "HTML Report (.html) ↓"}
        </a>

        {/* Markdown */}
        <a
          href={`/api/reports/${auditId}/markdown`}
          download={`blindspot-report-${safeId}.md`}
          onClick={(e) => triggerClientDownload("markdown", e)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            color: "var(--color-text-primary)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            textDecoration: "none",
            cursor: "pointer",
          }}
          title="Download Markdown summary document (.md)"
        >
          {downloadingFormat === "markdown" ? "Generating..." : "Markdown (.md) ↓"}
        </a>

        {/* JSON */}
        <a
          href={`/api/reports/${auditId}/json`}
          download={`blindspot-report-${safeId}.json`}
          onClick={(e) => triggerClientDownload("json", e)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "6px 12px",
            borderRadius: "var(--radius-xs)",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subdued)",
            color: "var(--color-text-secondary)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            textDecoration: "none",
            cursor: "pointer",
          }}
          title="Download JSON data schema (.json)"
        >
          {downloadingFormat === "json" ? "Generating..." : "JSON Data (.json) ↓"}
        </a>
      </div>
    </div>
  );
};
