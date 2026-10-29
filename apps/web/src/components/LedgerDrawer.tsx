import React, { useState } from "react";
import { Stat } from "./ui/Stat.js";

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
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--space-6)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "var(--space-4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--color-surface-1)",
          border: "none",
          color: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
        aria-expanded={isOpen}
      >
        <div>
          <div
            style={{
              fontSize: "var(--font-size-base)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Token factory telemetry ledger
          </div>
          <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {ledger.length} model invocations · {(totalLatencyMs / 1000).toFixed(2)}s total compute time
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", gap: "var(--space-2)", fontSize: "var(--font-size-sm)", fontFamily: "var(--font-mono)" }}>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-subdued)",
                color: "var(--color-text-secondary)",
              }}
            >
              Nano: {nanoCalls.length}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-subdued)",
                color: "var(--color-severity-major)",
              }}
            >
              Super: {superCalls.length}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-subdued)",
                color: "var(--color-status-success)",
              }}
            >
              Ultra: {ultraCalls.length}
            </span>
          </div>

          <span
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-secondary)",
              padding: "4px 10px",
              backgroundColor: "var(--color-surface-2)",
              borderRadius: "var(--radius-sm)",
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
            padding: "0 var(--space-4) var(--space-4)",
            borderTop: "1px solid var(--color-border-subdued)",
          }}
        >
          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--space-3)",
              margin: "var(--space-4) 0",
            }}
          >
            <div
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-subdued)",
              }}
            >
              <Stat label="Tokens in" value={totalTokensIn.toLocaleString()} />
            </div>

            <div
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-subdued)",
              }}
            >
              <Stat label="Tokens out" value={totalTokensOut.toLocaleString()} valueColor="var(--color-status-success)" />
            </div>

            <div
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-surface-2)",
                border: "1px solid var(--color-border-subdued)",
              }}
            >
              <Stat label="Total model latency" value={`${(totalLatencyMs / 1000).toFixed(2)}s`} />
            </div>
          </div>

          {/* Calls Table */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "var(--font-size-sm)",
                fontFamily: "var(--font-mono)",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--color-border-subdued)",
                    color: "var(--color-text-secondary)",
                    backgroundColor: "var(--color-surface-2)",
                  }}
                >
                  <th scope="col" style={{ padding: "8px 12px", fontWeight: 600 }}>Tier</th>
                  <th scope="col" style={{ padding: "8px 12px", fontWeight: 600 }}>Model</th>
                  <th scope="col" style={{ padding: "8px 12px", fontWeight: 600 }}>Prompt tokens</th>
                  <th scope="col" style={{ padding: "8px 12px", fontWeight: 600 }}>Completion tokens</th>
                  <th scope="col" style={{ padding: "8px 12px", fontWeight: 600 }}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((c, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid var(--color-border-subdued)",
                    }}
                  >
                    <th
                      scope="row"
                      style={{
                        padding: "8px 12px",
                        fontWeight: 600,
                        color:
                          c.tier === "ultra"
                            ? "var(--color-status-success)"
                            : c.tier === "super"
                            ? "var(--color-severity-major)"
                            : "var(--color-text-primary)",
                      }}
                    >
                      {c.tier}
                    </th>
                    <td style={{ padding: "8px 12px", color: "var(--color-text-primary)" }}>{c.model}</td>
                    <td style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>{c.tokensIn}</td>
                    <td style={{ padding: "8px 12px", color: "var(--color-status-success)" }}>{c.tokensOut}</td>
                    <td style={{ padding: "8px 12px", color: "var(--color-text-muted)" }}>{c.latencyMs}ms</td>
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
