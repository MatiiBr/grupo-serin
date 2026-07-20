import { PlanAgentJobStatus as PrismaPlanAgentJobStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { PlanAgentJobService } from './plan-agent-job.service';
import type { PlanningAgentPreview } from './planning-agent.service';

/**
 * loading-agent-llm async job flow — `PlanAgentJobService` is now backed by a
 * durable `PlanAgentJob` Prisma table (state survives a process restart and
 * is queryable), while the background `plan()` EXECUTION stays in-process —
 * see the class-level comment in `plan-agent-job.service.ts`. `PrismaService`
 * and `PlanningAgentService` are both mocked here — no real DB/DeepSeek/network.
 */
describe('PlanAgentJobService', () => {
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

  function createService(prisma: ReturnType<typeof createPrisma>, planningAgentService: { plan: ReturnType<typeof vi.fn> }) {
    return new PlanAgentJobService(prisma as unknown as PrismaService, planningAgentService as never);
  }

  beforeEach(() => vi.clearAllMocks());

  it('start() creates a RUNNING job row and returns the jobId immediately, before plan() settles', () => {
    let resolvePlan: (value: PlanningAgentPreview) => void = () => {};
    const planningAgentService = {
      plan: vi.fn(() => new Promise<PlanningAgentPreview>((resolve) => { resolvePlan = resolve; })),
    };
    const prisma = createPrisma();
    const jobService = createService(prisma, planningAgentService);

    const result = jobService.start('op-1', 'no stacking on P-100');

    expect(result.status).toBe('running');
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId.length).toBeGreaterThan(0);
    expect(prisma.planAgentJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: result.jobId, operationId: 'op-1', status: PrismaPlanAgentJobStatus.RUNNING }),
      }),
    );
    expect(planningAgentService.plan).not.toHaveBeenCalled();

    resolvePlan(buildPreview());
  });

  it('marks the job succeeded with the resolved preview once plan() resolves', async () => {
    const preview = buildPreview({ explanation: 'agent explanation text' });
    const planningAgentService = { plan: vi.fn().mockResolvedValue(preview) };
    const prisma = createPrisma();
    const jobService = createService(prisma, planningAgentService);

    const { jobId } = jobService.start('op-2', 'keep COIL out of CABIN_SIDE');
    await jobService.whenSettled(jobId);

    expect(prisma.planAgentJob.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: { status: PrismaPlanAgentJobStatus.SUCCEEDED, result: JSON.parse(JSON.stringify(preview)) },
    });
  });

  it('marks the job failed with the error message/name when plan() rejects, without throwing out of start()', async () => {
    const planningAgentService = { plan: vi.fn().mockRejectedValue(new Error('DeepSeek is unavailable after retries were exhausted.')) };
    const prisma = createPrisma();
    const jobService = createService(prisma, planningAgentService);

    let started: { jobId: string; status: 'running' } | undefined;
    expect(() => {
      started = jobService.start('op-3', 'bad rules');
    }).not.toThrow();

    await jobService.whenSettled(started!.jobId);

    expect(prisma.planAgentJob.update).toHaveBeenCalledWith({
      where: { id: started!.jobId },
      data: {
        status: PrismaPlanAgentJobStatus.FAILED,
        error: 'DeepSeek is unavailable after retries were exhausted.',
        errorName: 'Error',
      },
    });
  });

  it('get() returns the mapped job for a known id', async () => {
    const planningAgentService = { plan: vi.fn() };
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
    const jobService = createService(prisma, planningAgentService);

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
    const planningAgentService = { plan: vi.fn() };
    const prisma = createPrisma();
    prisma.planAgentJob.findUnique.mockResolvedValue(null);
    const jobService = createService(prisma, planningAgentService);

    await expect(jobService.get('does-not-exist')).resolves.toBeUndefined();
  });

  it('two calls to start() produce distinct jobIds', () => {
    const planningAgentService = { plan: vi.fn().mockResolvedValue(buildPreview()) };
    const prisma = createPrisma();
    const jobService = createService(prisma, planningAgentService);

    const first = jobService.start('op-5', 'rules a');
    const second = jobService.start('op-5', 'rules b');

    expect(first.jobId).not.toBe(second.jobId);
  });
});
