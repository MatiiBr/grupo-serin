/**
 * loading-agent-llm resilience protocol — small, reusable in-process
 * request queue. Paces async work through two independent knobs:
 *   - `maxConcurrency`: how many tasks may be in-flight at once (default 1,
 *     i.e. fully serialized).
 *   - `minIntervalMs`: minimum spacing enforced between task STARTS,
 *     regardless of concurrency headroom (default 0, i.e. no spacing).
 * Not DeepSeek-specific — `DeepSeekClient` is its first consumer, but this
 * class has zero knowledge of HTTP/fetch/DeepSeek.
 */

export interface RequestQueueOptions {
  maxConcurrency?: number;
  minIntervalMs?: number;
}

type PendingRunner = () => void;

export class RequestQueue {
  private readonly maxConcurrency: number;
  private readonly minIntervalMs: number;
  private readonly pending: PendingRunner[] = [];
  private active = 0;
  private lastStartAt: number | undefined;
  private pumpTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: RequestQueueOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 1;
    this.minIntervalMs = options.minIntervalMs ?? 0;
  }

  /** Acquires a slot (respecting concurrency + spacing), runs `task`, then releases the slot. */
  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push(() => {
        this.active += 1;
        this.lastStartAt = Date.now();

        task()
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.pump();
          });
      });

      this.pump();
    });
  }

  private pump(): void {
    if (this.pending.length === 0 || this.active >= this.maxConcurrency) {
      return;
    }

    const waitMs = this.lastStartAt === undefined ? 0 : this.minIntervalMs - (Date.now() - this.lastStartAt);

    if (waitMs > 0) {
      this.scheduleDelayedPump(waitMs);
      return;
    }

    const runNext = this.pending.shift();
    runNext?.();

    // A slot may still be free (maxConcurrency > 1) and spacing may already
    // be satisfied for the following pending task — try again immediately.
    this.pump();
  }

  private scheduleDelayedPump(waitMs: number): void {
    if (this.pumpTimer !== undefined) return;

    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = undefined;
      this.pump();
    }, waitMs);
  }
}
