import { PlanAgentJobStatus as PrismaPlanAgentJobStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanningAgentPreview } from './planning-agent.service';

/**
 * loading-agent-llm Batch 13 — `PlanAgentWorker` processor unit tests.
 * `bullmq`'s `Worker` is mocked so `onModuleInit`/`onModuleDestroy` never
 * touch Redis; the `processJob` method (the extracted, directly-testable
 * processor body) is exercised with a fake job payload plus mocked
 * `PlanningAgentService`/`PrismaService` — no real DeepSeek/network/DB.
 */
const workerCloseMock = vi.fn().mockResolvedValue(undefined);

/** A real class (not an arrow/plain-object-returning fn) so `new Worker(...)` works under the mock. */
class FakeWorker {
  close = workerCloseMock;
}

const WorkerCtorMock = vi.fn(function FakeWorkerCtor(this: FakeWorker) {
  Object.assign(this, new FakeWorker());
});

vi.mock('bullmq', () => ({
  Worker: WorkerCtorMock,
}));

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
      update: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('PlanAgentWorker (loading-agent-llm Batch 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processJob (extracted processor)', () => {
    it('success path — calls plan() then persists SUCCEEDED with the (JSON-round-tripped) result', async () => {
      const { PlanAgentWorker } = await import('./plan-agent-worker');
      const preview = buildPreview({ explanation: 'agent explanation text' });
      const planningAgentService = { plan: vi.fn().mockResolvedValue(preview) };
      const prisma = createPrisma();
      const worker = new PlanAgentWorker({ url: undefined, host: '127.0.0.1', port: 6381 } as never, prisma as unknown as PrismaService, planningAgentService as never);

      await worker.processJob({ jobId: 'job-1', operationId: 'op-1', rulesText: 'no stacking on P-100' });

      expect(planningAgentService.plan).toHaveBeenCalledWith('op-1', 'no stacking on P-100');
      expect(prisma.planAgentJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: PrismaPlanAgentJobStatus.SUCCEEDED, result: JSON.parse(JSON.stringify(preview)) },
      });
    });

    it('failure path — plan() throws: persists FAILED with error message/name, then rethrows', async () => {
      const { PlanAgentWorker } = await import('./plan-agent-worker');
      const error = new Error('DeepSeek is unavailable after retries were exhausted.');
      const planningAgentService = { plan: vi.fn().mockRejectedValue(error) };
      const prisma = createPrisma();
      const worker = new PlanAgentWorker({ url: undefined, host: '127.0.0.1', port: 6381 } as never, prisma as unknown as PrismaService, planningAgentService as never);

      await expect(worker.processJob({ jobId: 'job-2', operationId: 'op-2', rulesText: 'bad rules' })).rejects.toThrow(
        'DeepSeek is unavailable after retries were exhausted.',
      );

      expect(prisma.planAgentJob.update).toHaveBeenCalledWith({
        where: { id: 'job-2' },
        data: {
          status: PrismaPlanAgentJobStatus.FAILED,
          error: 'DeepSeek is unavailable after retries were exhausted.',
          errorName: 'Error',
        },
      });
    });

    it('failure path with a non-Error thrown value — persists FAILED with String(error) and errorName undefined', async () => {
      const { PlanAgentWorker } = await import('./plan-agent-worker');
      const planningAgentService = { plan: vi.fn().mockRejectedValue('a plain string rejection') };
      const prisma = createPrisma();
      const worker = new PlanAgentWorker({ url: undefined, host: '127.0.0.1', port: 6381 } as never, prisma as unknown as PrismaService, planningAgentService as never);

      await expect(worker.processJob({ jobId: 'job-3', operationId: 'op-3', rulesText: 'x' })).rejects.toBe('a plain string rejection');

      expect(prisma.planAgentJob.update).toHaveBeenCalledWith({
        where: { id: 'job-3' },
        data: { status: PrismaPlanAgentJobStatus.FAILED, error: 'a plain string rejection', errorName: undefined },
      });
    });
  });

  describe('lifecycle', () => {
    it('onModuleInit constructs a BullMQ Worker bound to the plan-agent queue with the resolved connection', async () => {
      const { PlanAgentWorker, PLAN_AGENT_QUEUE_NAME } = await import('./plan-agent-worker').then(async (mod) => ({
        ...mod,
        PLAN_AGENT_QUEUE_NAME: (await import('./plan-agent-queue')).PLAN_AGENT_QUEUE_NAME,
      }));
      const prisma = createPrisma();
      const planningAgentService = { plan: vi.fn() };
      const worker = new PlanAgentWorker({ url: undefined, host: '127.0.0.1', port: 6381 } as never, prisma as unknown as PrismaService, planningAgentService as never);

      expect(WorkerCtorMock).not.toHaveBeenCalled();

      worker.onModuleInit();

      expect(WorkerCtorMock).toHaveBeenCalledTimes(1);
      expect(WorkerCtorMock).toHaveBeenCalledWith(PLAN_AGENT_QUEUE_NAME, expect.any(Function), { connection: { host: '127.0.0.1', port: 6381 } });
    });

    it('onModuleDestroy closes the Worker if onModuleInit ran', async () => {
      const { PlanAgentWorker } = await import('./plan-agent-worker');
      const prisma = createPrisma();
      const planningAgentService = { plan: vi.fn() };
      const worker = new PlanAgentWorker({ url: undefined, host: '127.0.0.1', port: 6381 } as never, prisma as unknown as PrismaService, planningAgentService as never);
      worker.onModuleInit();

      await worker.onModuleDestroy();

      expect(workerCloseMock).toHaveBeenCalledTimes(1);
    });

    it('onModuleDestroy is a no-op when onModuleInit never ran', async () => {
      const { PlanAgentWorker } = await import('./plan-agent-worker');
      const prisma = createPrisma();
      const planningAgentService = { plan: vi.fn() };
      const worker = new PlanAgentWorker({ url: undefined, host: '127.0.0.1', port: 6381 } as never, prisma as unknown as PrismaService, planningAgentService as never);

      await expect(worker.onModuleDestroy()).resolves.toBeUndefined();
      expect(workerCloseMock).not.toHaveBeenCalled();
    });
  });
});
