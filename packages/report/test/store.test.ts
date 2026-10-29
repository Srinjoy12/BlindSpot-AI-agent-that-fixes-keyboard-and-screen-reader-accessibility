// test/store.test.ts — Unit tests for secure ReportStore.
// Tests UUID generation, 1-hour expiration TTL, oldest-first FIFO eviction,
// and resistance against sequential ID guessing attacks.

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { ReportStore } from "../src/store.js";
import type { AuditReport } from "../src/types.js";

function createMockReport(id: string): AuditReport {
  return {
    auditId: id,
    timestamp: new Date().toISOString(),
    targetUrl: "https://example.com/test",
    keyboardScore: 85,
    summary: {
      totalStops: 10,
      barriersFound: 1,
      blockers: 1,
      majors: 0,
      minors: 0,
      fixesVerified: 1,
    },
    barriers: [],
    aiTransparency: {
      totalCalls: 3,
      totalTokensIn: 600,
      totalTokensOut: 0,
      totalLatencyMs: 0,
      tiers: {
        nano: { calls: 1, tokens: 100 },
        super: { calls: 1, tokens: 200 },
        ultra: { calls: 1, tokens: 300 },
      },
      tavilyQueries: [],
    },
    durationMs: 1200,
  };
}

describe("ReportStore Security & Storage Suite", () => {
  it("generates valid crypto.randomUUID() identifiers", () => {
    const store = new ReportStore();
    const id1 = store.generateId();
    const id2 = store.generateId();

    expect(store.isValidId(id1)).toBe(true);
    expect(store.isValidId(id2)).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it("prevents sequential ID guessing attacks", () => {
    const store = new ReportStore();
    const validId = store.generateId();
    store.set(validId, createMockReport(validId));

    // Guessing attacks with sequential numbers, prefixes, or malformed strings
    expect(store.get("1")).toBeNull();
    expect(store.get("2")).toBeNull();
    expect(store.get("audit_1")).toBeNull();
    expect(store.get("report-001")).toBeNull();
    expect(store.get("00000000-0000-0000-0000-000000000001")).toBeNull();
    expect(store.get("../etc/passwd")).toBeNull();

    // Valid UUID retrieves report
    expect(store.get(validId)).not.toBeNull();
    expect(store.get(validId)?.auditId).toBe(validId);
  });

  it("expires reports after 1 hour (TTL)", () => {
    const oneHourMs = 60 * 60 * 1000;
    const store = new ReportStore({ ttlMs: oneHourMs });
    const id = store.generateId();
    store.set(id, createMockReport(id));

    expect(store.get(id)).not.toBeNull();

    // Simulate 61 minutes later
    const futureTime = Date.now() + 61 * 60 * 1000;
    store.cleanExpired(futureTime);

    expect(store.get(id)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("evicts oldest reports first when maxReports cap is reached", () => {
    const store = new ReportStore({ maxReports: 3 });

    const id1 = store.generateId();
    const id2 = store.generateId();
    const id3 = store.generateId();
    const id4 = store.generateId();

    store.set(id1, createMockReport(id1));
    store.set(id2, createMockReport(id2));
    store.set(id3, createMockReport(id3));
    expect(store.size).toBe(3);

    // Adding 4th report must evict id1 (oldest FIFO)
    store.set(id4, createMockReport(id4));

    expect(store.size).toBe(3);
    expect(store.get(id1)).toBeNull(); // Evicted!
    expect(store.get(id2)).not.toBeNull();
    expect(store.get(id3)).not.toBeNull();
    expect(store.get(id4)).not.toBeNull();
  });

  it("evicts oldest reports when byte capacity limit is reached", () => {
    // Set cap to 600 bytes (each report is ~400 bytes)
    const store = new ReportStore({ maxBytes: 600 });

    const id1 = store.generateId();
    const id2 = store.generateId();

    const report1 = createMockReport(id1);
    const report2 = createMockReport(id2);

    store.set(id1, report1);
    const size1 = store.currentBytes;
    expect(size1).toBeGreaterThan(0);

    // Setting second report should evict first report if together they exceed 1024 bytes
    store.set(id2, report2);

    expect(store.get(id1)).toBeNull(); // Evicted due to byte cap
    expect(store.get(id2)).not.toBeNull();
  });
});
