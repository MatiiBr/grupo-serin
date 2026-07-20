import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
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

/**
 * loading-agent-llm async job flow — lets `POST .../plan-agent/jobs` return
 * immediately (202) while `PlanningAgentService.plan()` (the self-correcting
 * re-plan loop: several sequential DeepSeek calls, can exceed 5 min) keeps
 * running in the background, instead of blocking the HTTP request until it
 * settles. `start()` fires `plan()` WITHOUT awaiting it and returns the
 * jobId right away; the caller polls `GET .../plan-agent/jobs/:jobId`.
 *
 * NOTE: in-memory + single-instance + non-persistent — this is an MVP job
 * runner. It does not survive a process restart and does not work across
 * multiple API instances. Production should use a durable queue/store
 * (e.g. BullMQ + Redis, or a `PlanAgentJob` Prisma table) instead of the
 * in-memory `Map` below.
 */
@Injectable()
export class PlanAgentJobService {
  private readonly jobs = new Map<string, PlanAgentJob>();
  private readonly settlement = new Map<string, Promise<void>>();

  constructor(private readonly planningAgentService: PlanningAgentService) {}

  start(operationId: string, rulesText: string): PlanAgentJobStarted {
    const jobId = randomUUID();
    const job: PlanAgentJob = {
      id: jobId,
      operationId,
      status: 'running',
      createdAt: new Date(),
    };
    this.jobs.set(jobId, job);

    const settled = this.planningAgentService.plan(operationId, rulesText).then(
      (result) => {
        job.status = 'succeeded';
        job.result = result;
      },
      (error: unknown) => {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        job.errorName = error instanceof Error ? error.name : undefined;
      },
    );
    this.settlement.set(jobId, settled);

    return { jobId, status: 'running' };
  }

  get(jobId: string): PlanAgentJob | undefined {
    return this.jobs.get(jobId);
  }

  /** Test-only hook: resolves once the background `plan()` call for `jobId` has settled (succeeded or failed). */
  whenSettled(jobId: string): Promise<void> {
    return this.settlement.get(jobId) ?? Promise.resolve();
  }
}
