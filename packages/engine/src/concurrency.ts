// concurrency.ts — Global limit on simultaneous browser audits with queueing.
// Emits SSE 'queued' events with queue position and aheadCount.
// Returns 503 when queue capacity (maxQueue) is full.

export interface QueuedAuditItem {
  id: string;
  res?: { write: (chunk: string) => void } | undefined;
  dispatch: () => void;
}

export class AuditConcurrencyController {
  private activeCount = 0;
  private queue: QueuedAuditItem[] = [];
  readonly maxConcurrent: number;
  readonly maxQueue: number;

  constructor(maxConcurrent?: number, maxQueue = 10) {
    this.maxConcurrent =
      maxConcurrent ??
      (process.env.MAX_CONCURRENT_AUDITS
        ? parseInt(process.env.MAX_CONCURRENT_AUDITS, 10)
        : 2);
    this.maxQueue = maxQueue;
  }

  get active(): number {
    return this.activeCount;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  /**
   * Attempts to acquire an audit execution slot.
   * - If below concurrency limit, increments active count and returns release callback immediately.
   * - If at concurrency limit but below queue limit, emits SSE 'queued' event and waits for dispatch.
   * - If queue is full, throws an Error with status 503.
   */
  async acquire(
    res?: { write: (chunk: string) => void },
    req?: { on: (event: string, listener: () => void) => void },
    auditId: string = ""
  ): Promise<() => void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      return this.createRelease();
    }

    if (this.queue.length >= this.maxQueue) {
      const err: any = new Error(
        `Server busy: audit queue is full (maximum ${this.maxQueue} waiting). Please try again shortly.`
      );
      err.status = 503;
      throw err;
    }

    return new Promise<() => void>((resolve) => {
      let dispatched = false;

      const queuedItem: QueuedAuditItem = {
        id: auditId,
        res,
        dispatch: () => {
          dispatched = true;
          this.activeCount++;
          this.broadcastQueuePositions();
          resolve(this.createRelease());
        },
      };

      this.queue.push(queuedItem);

      // Emit initial queued SSE event
      const position = this.queue.length;
      const aheadCount = position - 1;
      try {
        res?.write(`event: queued\ndata: ${JSON.stringify({ position, aheadCount })}\n\n`);
      } catch {}

      req?.on("close", () => {
        if (!dispatched) {
          const idx = this.queue.indexOf(queuedItem);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
            this.broadcastQueuePositions();
          }
        }
      });
    });
  }

  private broadcastQueuePositions(): void {
    this.queue.forEach((item, idx) => {
      const position = idx + 1;
      const aheadCount = idx;
      try {
        item.res?.write(`event: queued\ndata: ${JSON.stringify({ position, aheadCount })}\n\n`);
      } catch {}
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeCount = Math.max(0, this.activeCount - 1);
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        next.dispatch();
      }
    };
  }
}

export const auditConcurrency = new AuditConcurrencyController();
