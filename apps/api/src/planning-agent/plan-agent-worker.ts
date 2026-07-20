import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PlanAgentJobStatus as PrismaPlanAgentJobStatus, type Prisma } from '@prisma/client';
import { Worker, type Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { buildRedisConnection, redisConfig } from './config/redis.config';
import { PLAN_AGENT_QUEUE_NAME, type PlanAgentJobData } from './plan-agent-queue';
import type { PlanningAgentPreview } from './planning-agent.service';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm Batch 13 — the actual EXECUTOR of `plan-agent` jobs.
 * Replaces Batch 12's in-process `.then(() => planningAgentService.plan(...))`
 * chained inside `PlanAgentJobService.start()`. Jobs are enqueued by
 * `PlanAgentQueue` (any API instance) and picked up here by whichever
 * instance's `Worker` claims them — the "true multi-instance/worker
 * execution" follow-up flagged in Batch 12's class-level comment on
 * `PlanAgentJobService`.
 *
 * The BullMQ `Worker` (and its Redis connection) is created in
 * `onModuleInit`, NOT the constructor. Nest's `TestingModule.compile()` only
 * runs constructors, not lifecycle hooks (`onModuleInit`/`onModuleDestroy`
 * require an explicit `.init()`), so `planning-agent.module.spec.ts` stays
 * Redis-free without needing to override this provider.
 */
@Injectable()
export class PlanAgentWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<PlanAgentJobData> | undefined;

  constructor(
    @Inject(redisConfig.KEY) private readonly config: ConfigType<typeof redisConfig>,
    private readonly prisma: PrismaService,
    private readonly planningAgentService: PlanningAgentService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<PlanAgentJobData>(
      PLAN_AGENT_QUEUE_NAME,
      (job: Job<PlanAgentJobData>) => this.processJob(job.data),
      { connection: buildRedisConnection(this.config) },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  /**
   * Extracted from the BullMQ processor callback so it is directly unit
   * testable with a fake `{ jobId, operationId, rulesText }` payload plus
   * mocked `planningAgentService`/`prisma` — no Redis/Worker/Queue involved.
   *
   * Rethrow-vs-swallow decision: this RETHROWS after persisting FAILED to the
   * `PlanAgentJob` row. Our domain state is durably written either way (the
   * `catch` block always runs `persistFailed` first); rethrowing on top of
   * that additionally lets BullMQ mark its OWN job as failed, which:
   *   - shows up in BullMQ introspection/metrics (queue depth, failed count)
   *     instead of silently looking like every job succeeded from the
   *     queue's point of view, and
   *   - makes the job eligible for BullMQ's own retry config if one is ever
   *     added (today none is configured, so BullMQ's default of zero retries
   *     applies — rethrowing does not cause `plan()` to run twice).
   * The alternative (swallowing) would keep BullMQ's bookkeeping "clean" but
   * hide domain failures from anyone watching the queue itself.
   */
  async processJob(data: PlanAgentJobData): Promise<void> {
    try {
      const result = await this.planningAgentService.plan(data.operationId, data.rulesText);
      await this.persistSucceeded(data.jobId, result);
    } catch (error) {
      await this.persistFailed(data.jobId, error);
      throw error;
    }
  }

  private async persistSucceeded(jobId: string, result: PlanningAgentPreview): Promise<void> {
    // `result` may hold non-plain-JSON values in principle (the preview is a
    // hand-built domain object, not a DTO); round-trip it through JSON so
    // only Prisma `Json`-compatible data is ever written — mirrors Batch 12's
    // `persistSucceeded`.
    const serializedResult = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
    await this.prisma.planAgentJob.update({
      where: { id: jobId },
      data: { status: PrismaPlanAgentJobStatus.SUCCEEDED, result: serializedResult },
    });
  }

  private async persistFailed(jobId: string, error: unknown): Promise<void> {
    await this.prisma.planAgentJob.update({
      where: { id: jobId },
      data: {
        status: PrismaPlanAgentJobStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
      },
    });
  }
}
