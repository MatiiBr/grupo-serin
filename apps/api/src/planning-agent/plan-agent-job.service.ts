import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PlanAgentJobStatus as PrismaPlanAgentJobStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningAgentService, type PlanningAgentPreview } from './planning-agent.service';

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
 * settles. `start()` fires `plan()` WITHOUT awaiting it and returns the
 * jobId right away; the caller polls `GET .../plan-agent/jobs/:jobId`.
 *
 * STATE is durable — backed by the `PlanAgentJob` Prisma table (Postgres,
 * the existing datastore — no new infra). Job status/result/error survive a
 * process restart and are queryable directly in the DB. The background
 * EXECUTION is still in-process/single-instance: `plan()` runs on whichever
 * API instance received the `start()` call, and if that instance crashes or
 * restarts mid-run, the job row is left stuck in RUNNING with nothing to
 * resume it. True multi-instance/worker execution (so any instance can pick
 * up and finish a job) would need a real queue (e.g. BullMQ + Redis, or a
 * Postgres-based worker polling this same table) — a named follow-up, not
 * implemented here.
 */
@Injectable()
export class PlanAgentJobService {
  // Test-only hook (`whenSettled`) — stays in-memory on purpose: it exists so
  // specs can deterministically await the background write, it is not part
  // of the durable job STATE (which lives entirely in `PlanAgentJob` rows)
  // and is never read by `get()`.
  private readonly settlement = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly planningAgentService: PlanningAgentService,
  ) {}

  start(operationId: string, rulesText: string): PlanAgentJobStarted {
    const jobId = randomUUID();

    const settled = this.prisma.planAgentJob
      .create({ data: { id: jobId, operationId, status: PrismaPlanAgentJobStatus.RUNNING } })
      .then(() => this.planningAgentService.plan(operationId, rulesText))
      .then(
        async (result) => {
          await this.persistSucceeded(jobId, result);
        },
        async (error: unknown) => {
          await this.persistFailed(jobId, error);
        },
      )
      // The background settle must never throw out of `start()` — any
      // failure writing the final status (e.g. a transient DB error) is
      // swallowed here; the job row is left in whatever state the last
      // successful write produced (RUNNING, if even the failure write
      // itself could not land).
      .catch(() => undefined);

    this.settlement.set(jobId, settled);

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

  /** Test-only hook: resolves once the background `plan()` call for `jobId` has settled (succeeded or failed). */
  whenSettled(jobId: string): Promise<void> {
    return this.settlement.get(jobId) ?? Promise.resolve();
  }

  private async persistSucceeded(jobId: string, result: PlanningAgentPreview): Promise<void> {
    // `result` may hold non-plain-JSON values in principle (the preview is a
    // hand-built domain object, not a DTO); round-trip it through JSON so
    // only Prisma `Json`-compatible data is ever written.
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
