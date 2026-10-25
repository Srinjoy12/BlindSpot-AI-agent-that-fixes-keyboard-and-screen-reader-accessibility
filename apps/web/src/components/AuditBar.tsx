import React, { useState } from "react";

interface AuditBarProps {
  onStartAudit: (url: string, runFixes: boolean) => void;
  isRunning: boolean;
  fixtures: Array<{ id: string; title: string; htmlPath: string | null; barrierCount: number }>;
}

export const AuditBar: React.FC<AuditBarProps> = ({ onStartAudit, isRunning, fixtures }) => {
  const [url, setUrl] = useState<string>("/fixtures/B08-cookie-banner.html");
  const [runFixes, setRunFixes] = useState<boolean>(true);
  const [attested, setAttested] = useState<boolean>(false);

  const isLocalFixture = url.startsWith("/fixtures/") || url.includes("localhost") || url.includes("127.0.0.1");
  const canSubmit = !isRunning && url.trim().length > 0 && (isLocalFixture || attested);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onStartAudit(url.trim(), runFixes);
  };

  const handleSelectFixture = (htmlPath: string | null) => {
    if (htmlPath) {
      setUrl(htmlPath);
    }
  };

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-lg)",
        padding: "18px 20px",
        marginBottom: "20px",
      }}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Header Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <label
              htmlFor="target-url-input"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Target Endpoint or Fixture
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                id="enable-ultra-fix-checkbox"
                checked={runFixes}
                onChange={(e) => setRunFixes(e.target.checked)}
                style={{
                  accentColor: "var(--color-accent-emerald)",
                  width: "14px",
                  height: "14px",
                  cursor: "pointer",
                }}
              />
              <span>Generate verified fixes with Nemotron Ultra</span>
            </label>
          </div>

          {/* Main Input & Action Row */}
          <div className="audit-input-row" style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
            <div
              style={{
                position: "relative",
                flex: "1 1 auto",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "12px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-muted)",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
                aria-hidden="true"
              >
                URL
              </div>
              <input
                id="target-url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com or /fixtures/B08-cookie-banner.html"
                disabled={isRunning}
                style={{
                  width: "100%",
                  height: "38px",
                  padding: "0 12px 0 42px",
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border-subdued)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-text-primary)",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>

            <button
              id="audit-submit-button"
              type="submit"
              disabled={!canSubmit}
              title={
                !canSubmit && !isLocalFixture && !attested
                  ? "Attestation required for non-fixture URLs (FR-03)"
                  : ""
              }
              style={{
                height: "38px",
                padding: "0 18px",
                backgroundColor: canSubmit
                  ? "var(--color-accent-emerald)"
                  : "var(--color-surface-3)",
                color: canSubmit ? "#080C14" : "var(--color-text-muted)",
                fontWeight: 600,
                fontSize: "12px",
                borderRadius: "var(--radius-md)",
                border: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                whiteSpace: "nowrap",
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              <span>{isRunning ? "Crawling Keyboard Stops..." : "Run Audit & Verify"}</span>
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  opacity: 0.75,
                  padding: "1px 4px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: canSubmit ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.06)",
                }}
              >
                ⌘↵
              </span>
            </button>
          </div>

          {/* Attestation Banner for Non-Local URLs */}
          {!isLocalFixture && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                backgroundColor: "var(--color-surface-2)",
                border: attested
                  ? "1px solid var(--color-accent-emerald-border)"
                  : "1px solid var(--color-severity-major-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <input
                type="checkbox"
                id="ownership-attestation-checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
                disabled={isRunning}
                style={{
                  accentColor: "var(--color-accent-emerald)",
                  width: "14px",
                  height: "14px",
                  cursor: "pointer",
                }}
              />
              <label
                htmlFor="ownership-attestation-checkbox"
                style={{
                  fontSize: "12px",
                  color: attested ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <strong>Ownership Attestation (FR-03):</strong> I confirm authorization to test this target domain for accessibility barriers.
              </label>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", paddingTop: "2px" }}>
            <span
              style={{
                fontSize: "11px",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
                marginRight: "4px",
              }}
            >
              Presets:
            </span>
            {fixtures.map((f) => {
              const isSelected = url === f.htmlPath;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectFixture(f.htmlPath)}
                  disabled={isRunning}
                  style={{
                    padding: "3px 7px",
                    borderRadius: "var(--radius-xs)",
                    backgroundColor: isSelected
                      ? "var(--color-surface-3)"
                      : "var(--color-surface-2)",
                    border: isSelected
                      ? "1px solid var(--color-border-focus)"
                      : "1px solid var(--color-border-subdued)",
                    color: isSelected
                      ? "var(--color-text-primary)"
                      : "var(--color-text-secondary)",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    lineHeight: "15px",
                  }}
                >
                  <span>{f.id}</span>
                  <span
                    style={{
                      marginLeft: "5px",
                      color: f.barrierCount > 0 ? "var(--color-severity-major)" : "var(--color-accent-emerald)",
                      opacity: 0.9,
                    }}
                  >
                    ({f.barrierCount})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </div>
  );
};
