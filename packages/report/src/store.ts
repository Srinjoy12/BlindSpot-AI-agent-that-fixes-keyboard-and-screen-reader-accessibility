// store.ts — Secure in-memory report store with UUID validation,
// 1-hour expiration TTL, maximum report/byte capping, and FIFO oldest-first eviction.

import type { AuditReport } from "./types.js";

export interface StoredReport {
  id: string;
  report: AuditReport;
  createdAt: number;
  sizeBytes: number;
}

export interface ReportStoreOptions {
  maxReports?: number; // default: 200
  maxBytes?: number;   // default: 100 * 1024 * 1024 (100 MB)
  ttlMs?: number;      // default: 3,600,000 (1 hour)
}

export class ReportStore {
  private reports = new Map<string, StoredReport>();
  private totalBytes = 0;
  readonly maxReports: number;
  readonly maxBytes: number;
  readonly ttlMs: number;

  constructor(opts: ReportStoreOptions = {}) {
    this.maxReports = opts.maxReports ?? 200;
    this.maxBytes = opts.maxBytes ?? 100 * 1024 * 1024;
    this.ttlMs = opts.ttlMs ?? 60 * 60 * 1000;
  }

  /**
   * Generates a cryptographically strong UUID v4 for new audit reports.
   */
  generateId(): string {
    return globalThis.crypto.randomUUID();
  }

  /**
   * Validates whether an ID matches a standard UUID v4 format.
   * Sequential or predictable IDs (e.g., "1", "audit_1", "00000000-0000-0000-0000-000000000001")
   * are rejected to prevent enumeration and guessing attacks.
   */
  isValidId(id: string): boolean {
    if (!id || typeof id !== "string") return false;
    // Strict UUID v4 regex pattern
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Stores a report under its cryptographically generated UUID.
   * Performs proactive eviction of expired reports and FIFO eviction of oldest reports
   * if count exceeds maxReports or total memory exceeds maxBytes.
   */
  set(id: string, report: AuditReport): void {
    if (!this.isValidId(id)) {
      throw new Error(`Invalid report ID: '${id}'. IDs must be crypto.randomUUID() format.`);
    }

    this.cleanExpired();

    const json = JSON.stringify(report);
    const sizeBytes = Buffer.byteLength(json, "utf8");

    // If report already exists, subtract old size
    const existing = this.reports.get(id);
    if (existing) {
      this.totalBytes -= existing.sizeBytes;
      this.reports.delete(id);
    }

    // Evict oldest reports until both count and byte caps are respected
    while (
      this.reports.size >= this.maxReports ||
      (this.reports.size > 0 && this.totalBytes + sizeBytes > this.maxBytes)
    ) {
      this.evictOldest();
    }

    this.reports.set(id, {
      id,
      report,
      createdAt: Date.now(),
      sizeBytes,
    });
    this.totalBytes += sizeBytes;
  }

  /**
   * Retrieves a report by ID. Rejects invalid non-UUID IDs, non-existent IDs,
   * or expired reports (> 1 hour TTL).
   */
  get(id: string): AuditReport | null {
    if (!this.isValidId(id)) {
      return null;
    }

    this.cleanExpired();

    const item = this.reports.get(id);
    if (!item) return null;

    if (Date.now() - item.createdAt > this.ttlMs) {
      this.reports.delete(id);
      this.totalBytes -= item.sizeBytes;
      return null;
    }

    return item.report;
  }

  has(id: string): boolean {
    return this.get(id) !== null;
  }

  delete(id: string): boolean {
    const item = this.reports.get(id);
    if (!item) return false;
    this.totalBytes -= item.sizeBytes;
    return this.reports.delete(id);
  }

  get size(): number {
    this.cleanExpired();
    return this.reports.size;
  }

  get currentBytes(): number {
    this.cleanExpired();
    return this.totalBytes;
  }

  clear(): void {
    this.reports.clear();
    this.totalBytes = 0;
  }

  /**
   * Cleans all reports whose age exceeds the TTL.
   */
  cleanExpired(referenceTime: number = Date.now()): void {
    for (const [id, item] of this.reports.entries()) {
      if (referenceTime - item.createdAt > this.ttlMs) {
        this.totalBytes -= item.sizeBytes;
        this.reports.delete(id);
      }
    }
  }

  /**
   * Evicts the oldest report in storage (FIFO).
   */
  private evictOldest(): void {
    const firstEntry = this.reports.keys().next();
    if (!firstEntry.done && firstEntry.value) {
      const oldestId = firstEntry.value;
      const item = this.reports.get(oldestId);
      if (item) {
        this.totalBytes -= item.sizeBytes;
      }
      this.reports.delete(oldestId);
    }
  }
}
