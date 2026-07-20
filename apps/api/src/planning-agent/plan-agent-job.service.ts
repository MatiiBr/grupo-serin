import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PlanAgentJobStatus as PrismaPlanAgentJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlanAgentQueue } from './plan-agent-queue';
import type { PlanningAgentPreview } from './planning-agent.service';

export type PlanAgentJobStatus = 'running' | 'succeeded' | 'failed';

export interface PlanAgentJob {
  id: string;
  operationId: string;
  status: PlanAgentJobStatus;
  createdAt: Date;
  result?: PlanningAgentPreview;
  error?: string;
  errorName?: string;
}

export interface PlanAgentJobStarted {
  jobId: string;
  status: 'running';
}

const STATUS_TO_DOMAIN: Record<PrismaPlanAgentJobStatus, PlanAgentJobStatus> = {
  [PrismaPlanAgentJobStatus.RUNNING]: 'running',
  [PrismaPlanAgentJobStatus.SUCCEEDED]: 'succeeded',
  [PrismaPlanAgentJobStatus.FAILED]: 'failed',
};

/**
 * loading-agent-llm async job flow — lets `POST .../plan-agent/jobs` return
 * immediately (202) while `PlanningAgentService.plan()` (the self-correcting
 * re-plan loop: several sequential DeepSeek calls, can exceed 5 min) keeps
 * running in the background, instead of blocking the HTTP request until it
 * settles. The caller polls `GET .../plan-agent/jobs/:jobId`.
 *
 * STATE is durable — backed by the `PlanAgentJob` Prisma table (Postgres),
 * unchanged since Batch 12: job status/result/error survive a process
 * restart and are queryable directly in the DB.
 *
 * Batch 13 — EXECUTION is now a real BullMQ + Redis queue/worker instead of
 * Batch 12's in-process `.then(() => planningAgentService.plan(...))` chain.
 * `start()` only (a) creates the RUNNING row and (b) hands the job to
 * `PlanAgentQueue`; it no longer calls `planningAgentService.plan()` itself
 * — `PlanAgentWorker` (a separate provider, possibly running on a different
 * API instance) owns that now. This closes the multi-instance/crash-recovery
 * gap flagged in Batch 12's comment: any instance running the worker can
 * pick up and finish a job enqueued by any other instance.
 */
@Injectable()
export class PlanAgentJobService {
  // Test-only hook (`whenSettled`) — stays in-memory on purpose: it exists so
  // specs can deterministically await the background `create` + `enqueue`
  // chain inside `start()`. Repurposed from Batch 12: it no longer waits for
  // `plan()` to run (that happens in `PlanAgentWorker`, out of process) — it
  // now resolves once the job row has been created AND handed to the queue.
  // It is not part of the durable job STATE (which lives entirely in
  // `PlanAgentJob` rows) and is never read by `get()`.
  private readonly settlement = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: PlanAgentQueue,
  ) {}

  start(operationId: string, rulesText: string): PlanAgentJobStarted {
    const jobId = randomUUID();

    const enqueued = this.prisma.planAgentJob
      .create({ data: { id: jobId, operationId, status: PrismaPlanAgentJobStatus.RUNNING } })
      .then(() => this.queue.add('plan', { jobId, operationId, rulesText }))
      .then(() => undefined)
      // The background create+enqueue chain must never throw out of
      // `start()` — any failure here (e.g. a transient DB or Redis error) is
      // swallowed; the job row is left in whatever state the last successful
      // write produced (RUNNING, or nonexistent if even `create` failed).
      .catch(() => undefined);

    this.settlement.set(jobId, enqueued);

    return { jobId, status: 'running' };
  }

  async get(jobId: string): Promise<PlanAgentJob | undefined> {
    const row = await this.prisma.planAgentJob.findUnique({ where: { id: jobId } });
    if (!row) return undefined;

    return {
      id: row.id,
      operationId: row.operationId,
      status: STATUS_TO_DOMAIN[row.status],
      createdAt: row.createdAt,
      result: (row.result as PlanningAgentPreview | null) ?? undefined,
      error: row.error ?? undefined,
      errorName: row.errorName ?? undefined,
    };
  }

  /** Test-only hook: resolves once `start()`'s create+enqueue chain for `jobId` has completed. */
  whenSettled(jobId: string): Promise<void> {
    return this.settlement.get(jobId) ?? Promise.resolve();
  }
}
