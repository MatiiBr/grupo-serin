import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * loading-agent-llm Batch 13 — `PlanAgentQueue` producer wrapper. `bullmq`'s
 * `Queue` class is mocked here: no real Redis connection is ever opened, and
 * we assert the mock was NOT constructed until `add()` is called (confirms
 * the lazy-connection design that keeps `planning-agent.module.spec.ts`
 * Redis-free) and that it IS constructed with the resolved connection options
 * and forwards `add(name, data, { jobId })` correctly.
 */
const queueAddMock = vi.fn().mockResolvedValue(undefined);
const queueCloseMock = vi.fn().mockResolvedValue(undefined);

/** A real class (not an arrow/plain-object-returning fn) so `new Queue(...)` works under the mock. */
class FakeQueue {
  add = queueAddMock;
  close = queueCloseMock;
}

const QueueCtorMock = vi.fn(function FakeQueueCtor(this: FakeQueue) {
  Object.assign(this, new FakeQueue());
});

vi.mock('bullmq', () => ({
  Queue: QueueCtorMock,
}));

describe('PlanAgentQueue (loading-agent-llm Batch 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function importFresh() {
    vi.resetModules();
    const mod = await import('./plan-agent-queue');
    return mod;
  }

  it('does not construct the BullMQ Queue at instantiation time (lazy connection)', async () => {
    const { PlanAgentQueue } = await importFresh();

    new PlanAgentQueue({ url: undefined, host: '127.0.0.1', port: 6381 } as never);

    expect(QueueCtorMock).not.toHaveBeenCalled();
  });

  it('constructs the Queue with the resolved connection on the first add() call, and forwards name/data/jobId', async () => {
    const { PlanAgentQueue, PLAN_AGENT_QUEUE_NAME } = await importFresh();
    const queue = new PlanAgentQueue({ url: undefined, host: '127.0.0.1', port: 6381 } as never);

    await queue.add('plan', { jobId: 'job-1', operationId: 'op-1', rulesText: 'no stacking on P-100' });

    expect(QueueCtorMock).toHaveBeenCalledTimes(1);
    expect(QueueCtorMock).toHaveBeenCalledWith(PLAN_AGENT_QUEUE_NAME, { connection: { host: '127.0.0.1', port: 6381 } });
    expect(queueAddMock).toHaveBeenCalledWith(
      'plan',
      { jobId: 'job-1', operationId: 'op-1', rulesText: 'no stacking on P-100' },
      { jobId: 'job-1' },
    );
  });

  it('reuses the same underlying Queue across multiple add() calls', async () => {
    const { PlanAgentQueue } = await importFresh();
    const queue = new PlanAgentQueue({ url: undefined, host: '127.0.0.1', port: 6381 } as never);

    await queue.add('plan', { jobId: 'job-1', operationId: 'op-1', rulesText: 'a' });
    await queue.add('plan', { jobId: 'job-2', operationId: 'op-2', rulesText: 'b' });

    expect(QueueCtorMock).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy closes the underlying Queue if one was created', async () => {
    const { PlanAgentQueue } = await importFresh();
    const queue = new PlanAgentQueue({ url: undefined, host: '127.0.0.1', port: 6381 } as never);
    await queue.add('plan', { jobId: 'job-1', operationId: 'op-1', rulesText: 'a' });

    await queue.onModuleDestroy();

    expect(queueCloseMock).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy is a no-op when no Queue was ever created', async () => {
    const { PlanAgentQueue } = await importFresh();
    const queue = new PlanAgentQueue({ url: undefined, host: '127.0.0.1', port: 6381 } as never);

    await expect(queue.onModuleDestroy()).resolves.toBeUndefined();
    expect(queueCloseMock).not.toHaveBeenCalled();
  });
});
