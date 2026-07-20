import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Queue } from 'bullmq';
import { buildRedisConnection, redisConfig } from './config/redis.config';

export const PLAN_AGENT_QUEUE_NAME = 'plan-agent';

export interface PlanAgentJobData {
  jobId: string;
  operationId: string;
  rulesText: string;
}

/**
 * loading-agent-llm Batch 13 — thin producer wrapper around a BullMQ `Queue`
 * for the `plan-agent` queue. `PlanAgentJobService.start()` calls `add('plan',
 * data)` to hand a job off for the separate `PlanAgentWorker` process to
 * execute; it does not await execution, only enqueueing.
 *
 * The underlying `Queue` (and its ioredis connection) is built LAZILY inside
 * `getQueue()`, not in the constructor — Nest DI can instantiate
 * `PlanAgentQueue` (e.g. during `Test.createTestingModule(...).compile()`,
 * which runs constructors but not lifecycle hooks) without opening a real
 * Redis connection. Nothing connects to Redis until `add()` is actually
 * called for the first time.
 */
@Injectable()
export class PlanAgentQueue implements OnModuleDestroy {
  private queue: Queue<PlanAgentJobData> | undefined;

  constructor(@Inject(redisConfig.KEY) private readonly config: ConfigType<typeof redisConfig>) {}

  async add(name: string, data: PlanAgentJobData): Promise<void> {
    // Use the domain jobId as the BullMQ job id so the two ids line up
    // one-to-one — convenient for tracing/log correlation between the
    // `PlanAgentJob` Postgres row and the BullMQ job.
    await this.getQueue().add(name, data, { jobId: data.jobId });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  private getQueue(): Queue<PlanAgentJobData> {
    if (!this.queue) {
      this.queue = new Queue<PlanAgentJobData>(PLAN_AGENT_QUEUE_NAME, {
        connection: buildRedisConnection(this.config),
      });
    }
    return this.queue;
  }
}
