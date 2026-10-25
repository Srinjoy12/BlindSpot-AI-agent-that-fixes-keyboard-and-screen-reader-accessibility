import React, { useState } from "react";

export interface LedgerCall {
  tier: "nano" | "super" | "ultra";
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  costEstimateUsd?: number;
}

interface LedgerDrawerProps {
  ledger: LedgerCall[];
}

export const LedgerDrawer: React.FC<LedgerDrawerProps> = ({ ledger }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const totalTokensIn = ledger.reduce((acc, c) => acc + c.tokensIn, 0);
  const totalTokensOut = ledger.reduce((acc, c) => acc + c.tokensOut, 0);
  const totalLatencyMs = ledger.reduce((acc, c) => acc + c.latencyMs, 0);

  const nanoCalls = ledger.filter((c) => c.tier === "nano");
  const superCalls = ledger.filter((c) => c.tier === "super");
  const ultraCalls = ledger.filter((c) => c.tier === "ultra");

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-lg)",
        marginBottom: "20px",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--color-surface-1)",
          border: "none",
          color: "inherit",
          textAlign: "left",
        }}
        aria-expanded={isOpen}
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
            NVIDIA Token Factory & Telemetry Ledger
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {ledger.length} model invocations · {(totalLatencyMs / 1000).toFixed(2)}s total compute time
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "6px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
            <span
              style={{
                padding: "2px 5px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--color-border-subdued)",
                color: "var(--color-border-focus)",
              }}
            >
              Nano: {nanoCalls.length}
            </span>
            <span
              style={{
                padding: "2px 5px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--color-border-subdued)",
                color: "var(--color-severity-major)",
              }}
            >
              Super: {superCalls.length}
            </span>
            <span
              style={{
                padding: "2px 5px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--color-border-subdued)",
                color: "var(--color-accent-emerald)",
              }}
            >
              Ultra: {ultraCalls.length}
            </span>
          </div>

          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
              padding: "2px 6px",
              backgroundColor: "var(--color-surface-2)",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--color-border-subdued)",
            }}
          >
            {isOpen ? "− Collapse" : "+ Expand"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            padding: "0 20px 20px",
            borderTop: "1px solid var(--color-border-subdued)",
          }}
        >
          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
              margin: "14px 0",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-subdued)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                TOKENS IN
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-text-primary)",
                  marginTop: "2px",
                }}
              >
                {totalTokensIn.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-subdued)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                TOKENS OUT
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-accent-emerald)",
                  marginTop: "2px",
                }}
              >
                {totalTokensOut.toLocaleString()}
              </div>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-subdued)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                TOTAL AI LATENCY
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-border-focus)",
                  marginTop: "2px",
                }}
              >
                {(totalLatencyMs / 1000).toFixed(2)}s
              </div>
            </div>
          </div>

          {/* Calls Table */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border-subdued)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <th style={{ padding: "6px 10px" }}>Tier</th>
                  <th style={{ padding: "6px 10px" }}>Model</th>
                  <th style={{ padding: "6px 10px" }}>Prompt Tokens</th>
                  <th style={{ padding: "6px 10px" }}>Completion Tokens</th>
                  <th style={{ padding: "6px 10px" }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((c, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <td style={{ padding: "6px 10px" }}>
                      <span
                        style={{
                          textTransform: "uppercase",
                          fontWeight: 700,
                          fontSize: "9px",
                          padding: "1px 4px",
                          borderRadius: "var(--radius-xs)",
                          backgroundColor:
                            c.tier === "ultra"
                              ? "var(--color-accent-emerald-subtle)"
                              : c.tier === "super"
                              ? "var(--color-severity-major-bg)"
                              : "rgba(59, 130, 246, 0.1)",
                          color:
                            c.tier === "ultra"
                              ? "var(--color-accent-emerald)"
                              : c.tier === "super"
                              ? "var(--color-severity-major)"
                              : "var(--color-border-focus)",
                        }}
                      >
                        {c.tier}
                      </span>
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--color-text-primary)" }}>{c.model}</td>
                    <td style={{ padding: "6px 10px", color: "var(--color-text-muted)" }}>{c.tokensIn}</td>
                    <td style={{ padding: "6px 10px", color: "var(--color-accent-emerald)" }}>{c.tokensOut}</td>
                    <td style={{ padding: "6px 10px", color: "var(--color-text-secondary)" }}>{c.latencyMs}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
