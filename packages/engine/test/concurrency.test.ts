// test/concurrency.test.ts — Unit tests for AuditConcurrencyController.
// Tests MAX_CONCURRENT_AUDITS limit, FIFO queueing, SSE queued events,
// 503 on queue overflow, client disconnect handling, and slow audit slot releases.

import { describe, it, expect, vi } from "vitest";
import { AuditConcurrencyController } from "../src/concurrency.js";

describe("AuditConcurrencyController Suite", () => {
  it("allows up to maxConcurrent audits to run simultaneously", async () => {
    const controller = new AuditConcurrencyController(2, 5);
    const mockRes1: any = { write: vi.fn() };
    const mockReq1: any = { on: vi.fn() };
    const mockRes2: any = { write: vi.fn() };
    const mockReq2: any = { on: vi.fn() };

    const release1 = await controller.acquire(mockRes1, mockReq1, "audit-1");
    expect(controller.active).toBe(1);
    expect(controller.queuedCount).toBe(0);

    const release2 = await controller.acquire(mockRes2, mockReq2, "audit-2");
    expect(controller.active).toBe(2);
    expect(controller.queuedCount).toBe(0);

    release1();
    expect(controller.active).toBe(1);

    release2();
    expect(controller.active).toBe(0);
  });

  it("queues audits when maxConcurrent is reached and emits SSE queued events", async () => {
    const controller = new AuditConcurrencyController(2, 5);
    const mockReq: any = { on: vi.fn() };

    const release1 = await controller.acquire({ write: vi.fn() } as any, mockReq, "active-1");
    const release2 = await controller.acquire({ write: vi.fn() } as any, mockReq, "active-2");
    expect(controller.active).toBe(2);

    // 3rd audit: queued at position 1 (aheadCount 0)
    const res3Writes: string[] = [];
    const mockRes3: any = {
      write: vi.fn((chunk: string) => res3Writes.push(chunk)),
    };
    let slot3Dispatched = false;
    const p3 = controller.acquire(mockRes3, mockReq, "queued-1").then((rel) => {
      slot3Dispatched = true;
      return rel;
    });

    expect(controller.queuedCount).toBe(1);
    expect(slot3Dispatched).toBe(false);
    expect(res3Writes.some((w) => w.includes('"position":1,"aheadCount":0'))).toBe(true);

    // 4th audit: queued at position 2 (aheadCount 1)
    const res4Writes: string[] = [];
    const mockRes4: any = {
      write: vi.fn((chunk: string) => res4Writes.push(chunk)),
    };
    let slot4Dispatched = false;
    const p4 = controller.acquire(mockRes4, mockReq, "queued-2").then((rel) => {
      slot4Dispatched = true;
      return rel;
    });

    expect(controller.queuedCount).toBe(2);
    expect(slot4Dispatched).toBe(false);
    expect(res4Writes.some((w) => w.includes('"position":2,"aheadCount":1'))).toBe(true);

    // Release active-1 -> queued-1 should be dispatched
    release1();
    const release3 = await p3;
    expect(slot3Dispatched).toBe(true);
    expect(controller.active).toBe(2);
    expect(controller.queuedCount).toBe(1);

    // queued-2 should now be at position 1 (aheadCount 0)
    expect(res4Writes.some((w) => w.includes('"position":1,"aheadCount":0'))).toBe(true);

    // Release active-2 -> queued-2 dispatched
    release2();
    const release4 = await p4;
    expect(slot4Dispatched).toBe(true);

    release3();
    release4();
    expect(controller.active).toBe(0);
    expect(controller.queuedCount).toBe(0);
  });

  it("returns 503 error when queue capacity (maxQueue) is full", async () => {
    const maxQueue = 3;
    const controller = new AuditConcurrencyController(1, maxQueue);
    const mockReq: any = { on: vi.fn() };
    const mockRes: any = { write: vi.fn() };

    const releaseActive = await controller.acquire(mockRes, mockReq, "active");

    // Fill queue with 3 requests
    const p1 = controller.acquire(mockRes, mockReq, "q1");
    const p2 = controller.acquire(mockRes, mockReq, "q2");
    const p3 = controller.acquire(mockRes, mockReq, "q3");

    expect(controller.queuedCount).toBe(3);

    // 4th request must be rejected with 503
    await expect(controller.acquire(mockRes, mockReq, "q4_overflow")).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("audit queue is full (maximum 3 waiting)"),
    });

    releaseActive();
    const r1 = await p1;
    r1();
    const r2 = await p2;
    r2();
    const r3 = await p3;
    r3();
  });

  it("handles client disconnect while in queue", async () => {
    const controller = new AuditConcurrencyController(1, 5);
    let closeListener: (() => void) | null = null;
    const mockReq: any = {
      on: vi.fn((event, cb) => {
        if (event === "close") closeListener = cb;
      }),
    };
    const mockRes: any = { write: vi.fn() };

    const releaseActive = await controller.acquire({ write: vi.fn() } as any, { on: vi.fn() } as any, "active");

    // Queue request
    controller.acquire(mockRes, mockReq, "client-disconnect");
    expect(controller.queuedCount).toBe(1);

    // Simulate client closing browser tab
    expect(closeListener).not.toBeNull();
    closeListener!();

    expect(controller.queuedCount).toBe(0);
    releaseActive();
  });
});
