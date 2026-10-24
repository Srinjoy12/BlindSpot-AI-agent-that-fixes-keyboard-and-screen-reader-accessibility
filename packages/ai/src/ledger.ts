// Ledger — records every model call for the routing drawer and feedback notes.
// Writes to an in-memory array; the API layer flushes it to SQLite.

export interface ModelCallRecord {
  id: string;
  auditId?: string;
  stage: "digest" | "analysis" | "fix" | "summary" | "repair";
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  cacheHit: boolean;
  outcome: "success" | "invalid_json" | "repaired" | "failed";
  timestamp: string;
}

const _ledger: ModelCallRecord[] = [];

export function recordCall(entry: ModelCallRecord): void {
  _ledger.push(entry);
}

export function getLedger(): readonly ModelCallRecord[] {
  return _ledger;
}

export function clearLedger(): void {
  _ledger.length = 0;
}

export function ledgerTotals(): {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalLatencyMs: number;
  cacheHits: number;
} {
  return _ledger.reduce(
    (acc, r) => ({
      totalCalls: acc.totalCalls + 1,
      totalTokensIn: acc.totalTokensIn + r.tokensIn,
      totalTokensOut: acc.totalTokensOut + r.tokensOut,
      totalLatencyMs: acc.totalLatencyMs + r.latencyMs,
      cacheHits: acc.cacheHits + (r.cacheHit ? 1 : 0),
    }),
    { totalCalls: 0, totalTokensIn: 0, totalTokensOut: 0, totalLatencyMs: 0, cacheHits: 0 }
  );
}
