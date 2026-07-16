import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestQueue } from './request-queue';

/**
 * loading-agent-llm resilience protocol — standalone in-process request
 * queue. Paces DeepSeek calls (or any async task) with a max concurrency
 * and a minimum spacing between call STARTS. Tested in isolation from
 * `DeepSeekClient` with `vi.useFakeTimers()` — no real waiting.
 */
describe('RequestQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs three enqueued tasks strictly one-at-a-time when maxConcurrency is 1', async () => {
    vi.useFakeTimers();
    const queue = new RequestQueue({ maxConcurrency: 1 });
    const events: string[] = [];

    function makeTask(name: string, delayMs: number) {
      return () =>
        new Promise<string>((resolve) => {
          events.push(`${name}:start`);
          setTimeout(() => {
            events.push(`${name}:end`);
            resolve(name);
          }, delayMs);
        });
    }

    const p1 = queue.enqueue(makeTask('a', 30));
    const p2 = queue.enqueue(makeTask('b', 10));
    const p3 = queue.enqueue(makeTask('c', 10));

    await vi.advanceTimersByTimeAsync(30);
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(10);

    await expect(Promise.all([p1, p2, p3])).resolves.toEqual(['a', 'b', 'c']);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('never starts a second task before the first one finishes, even when both are enqueued synchronously', async () => {
    vi.useFakeTimers();
    const queue = new RequestQueue({ maxConcurrency: 1 });
    let concurrentlyActive = 0;
    let maxObservedConcurrency = 0;

    function makeTask(delayMs: number) {
      return () =>
        new Promise<void>((resolve) => {
          concurrentlyActive += 1;
          maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentlyActive);
          setTimeout(() => {
            concurrentlyActive -= 1;
            resolve();
          }, delayMs);
        });
    }

    const results = Promise.all([queue.enqueue(makeTask(15)), queue.enqueue(makeTask(15)), queue.enqueue(makeTask(15))]);
    await vi.advanceTimersByTimeAsync(45);
    await results;

    expect(maxObservedConcurrency).toBe(1);
  });

  it('delays the next task start by at least minIntervalMs after the previous start', async () => {
    vi.useFakeTimers();
    const queue = new RequestQueue({ maxConcurrency: 2, minIntervalMs: 500 });
    const starts: number[] = [];

    function makeInstantTask() {
      return () => {
        starts.push(Date.now());
        return Promise.resolve('done');
      };
    }

    const p1 = queue.enqueue(makeInstantTask());
    await vi.advanceTimersByTimeAsync(0);
    const p2 = queue.enqueue(makeInstantTask());
    await vi.advanceTimersByTimeAsync(500);

    await Promise.all([p1, p2]);

    expect(starts).toHaveLength(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(500);
  });

  it('propagates the task rejection to the caller without blocking later tasks', async () => {
    vi.useFakeTimers();
    const queue = new RequestQueue({ maxConcurrency: 1 });

    const failing = queue.enqueue(() => Promise.reject(new Error('boom')));
    const following = queue.enqueue(() => Promise.resolve('ok'));

    await expect(failing).rejects.toThrow('boom');
    await expect(following).resolves.toBe('ok');
  });
});
