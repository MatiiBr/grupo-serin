import { PlanAgentJobStatus as PrismaPlanAgentJobStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanAgentQueue } from './plan-agent-queue';
import { PlanAgentJobService } from './plan-agent-job.service';
import type { PlanningAgentPreview } from './planning-agent.service';

/**
 * loading-agent-llm Batch 13 — `PlanAgentJobService.start()` no longer calls
 * `PlanningAgentService.plan()` in-process; it creates the RUNNING row and
 * hands the job to `PlanAgentQueue`, which the (separately tested)
 * `PlanAgentWorker` picks up. `PrismaService` and `PlanAgentQueue` are both
 * mocked here — no real DB/Redis/DeepSeek/network.
 */
describe('PlanAgentJobService (loading-agent-llm Batch 13 — queue-backed)', () => {
  function buildPreview(overrides: Partial<PlanningAgentPreview> = {}): PlanningAgentPreview {
    return {
      plan: { placedItems: [], unplacedItems: [], alerts: [] } as unknown as PlanningAgentPreview['plan'],
      explanation: 'ok',
      appliedRules: [],
      droppedRules: [],
      attempts: 1,
      resolutionLog: [],
      ...overrides,
    };
  }

  function createPrisma() {
    return {
      planAgentJob: {
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        findUnique: vi.fn(),
      },
    };
  }

  function createQueue() {
    return { add: vi.fn().mockResolvedValue(undefined) };
  }

  function createService(prisma: ReturnType<typeof createPrisma>, queue: ReturnType<typeof createQueue>) {
    return new PlanAgentJobService(prisma as unknown as PrismaService, queue as unknown as PlanAgentQueue);
  }

  beforeEach(() => vi.clearAllMocks());

  it('start() creates a RUNNING job row and returns the jobId immediately, before the queue add settles', () => {
    let resolveAdd: () => void = () => {};
    const queue = { add: vi.fn(() => new Promise<void>((resolve) => { resolveAdd = resolve; })) };
    const prisma = createPrisma();
    const jobService = createService(prisma, queue);

    const result = jobService.start('op-1', 'no stacking on P-100');

    expect(result.status).toBe('running');
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId.length).toBeGreaterThan(0);
    expect(prisma.planAgentJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: result.jobId, operationId: 'op-1', status: PrismaPlanAgentJobStatus.RUNNING }),
      }),
    );

    resolveAdd();
  });

  it('start() enqueues the job on the plan-agent queue with jobId/operationId/rulesText, and never calls plan() directly', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    const jobService = createService(prisma, queue);

    const { jobId } = jobService.start('op-2', 'keep COIL out of CABIN_SIDE');
    await jobService.whenSettled(jobId);

    expect(queue.add).toHaveBeenCalledWith('plan', { jobId, operationId: 'op-2', rulesText: 'keep COIL out of CABIN_SIDE' });
  });

  it('start() does not throw and leaves the job creatable even if the queue add() rejects', async () => {
    const queue = { add: vi.fn().mockRejectedValue(new Error('Redis is unreachable')) };
    const prisma = createPrisma();
    const jobService = createService(prisma, queue);

    let started: { jobId: string; status: 'running' } | undefined;
    expect(() => {
      started = jobService.start('op-3', 'bad rules');
    }).not.toThrow();

    await expect(jobService.whenSettled(started!.jobId)).resolves.toBeUndefined();
  });

  it('get() returns the mapped job for a known id', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    const createdAt = new Date('2026-07-19T00:00:00.000Z');
    const preview = buildPreview({ explanation: 'from db' });
    prisma.planAgentJob.findUnique.mockResolvedValue({
      id: 'job-abc',
      operationId: 'op-9',
      status: PrismaPlanAgentJobStatus.SUCCEEDED,
      result: preview,
      error: null,
      errorName: null,
      createdAt,
      updatedAt: createdAt,
    });
    const jobService = createService(prisma, queue);

    const job = await jobService.get('job-abc');

    expect(job).toEqual({
      id: 'job-abc',
      operationId: 'op-9',
      status: 'succeeded',
      createdAt,
      result: preview,
      error: undefined,
      errorName: undefined,
    });
    expect(prisma.planAgentJob.findUnique).toHaveBeenCalledWith({ where: { id: 'job-abc' } });
  });

  it('get() returns undefined for an unknown jobId', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.planAgentJob.findUnique.mockResolvedValue(null);
    const jobService = createService(prisma, queue);

    await expect(jobService.get('does-not-exist')).resolves.toBeUndefined();
  });

  it('two calls to start() produce distinct jobIds', () => {
    const queue = createQueue();
    const prisma = createPrisma();
    const jobService = createService(prisma, queue);

    const first = jobService.start('op-5', 'rules a');
    const second = jobService.start('op-5', 'rules b');

    expect(first.jobId).not.toBe(second.jobId);
  });
});
