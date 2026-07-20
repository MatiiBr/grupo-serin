import { describe, expect, it, vi } from 'vitest';
import { PlanAgentJobService } from './plan-agent-job.service';
import type { PlanningAgentPreview } from './planning-agent.service';

/**
 * loading-agent-llm async job flow — `PlanAgentJobService` is an in-memory,
 * single-instance job runner that lets `POST .../plan-agent/jobs` return
 * immediately (202) while `PlanningAgentService.plan()` (multiple sequential
 * DeepSeek calls, can exceed 5 min) keeps running in the background.
 * `PlanningAgentService` is mocked here — no real solver/DeepSeek/network.
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

  it('start() returns a jobId immediately and the job is running before plan() settles', () => {
    let resolvePlan: (value: PlanningAgentPreview) => void = () => {};
    const planningAgentService = {
      plan: vi.fn(() => new Promise<PlanningAgentPreview>((resolve) => { resolvePlan = resolve; })),
    };
    const jobService = new PlanAgentJobService(planningAgentService as never);

    const result = jobService.start('op-1', 'no stacking on P-100');

    expect(result.status).toBe('running');
    expect(typeof result.jobId).toBe('string');
    expect(result.jobId.length).toBeGreaterThan(0);

    const job = jobService.get(result.jobId);
    expect(job?.status).toBe('running');
    expect(job?.operationId).toBe('op-1');

    resolvePlan(buildPreview());
  });

  it('marks the job succeeded with the resolved preview once plan() resolves', async () => {
    const preview = buildPreview({ explanation: 'agent explanation text' });
    const planningAgentService = { plan: vi.fn().mockResolvedValue(preview) };
    const jobService = new PlanAgentJobService(planningAgentService as never);

    const { jobId } = jobService.start('op-2', 'keep COIL out of CABIN_SIDE');
    await jobService.whenSettled(jobId);

    const job = jobService.get(jobId);
    expect(job?.status).toBe('succeeded');
    expect(job?.result).toEqual(preview);
  });

  it('marks the job failed with the error message when plan() rejects, without throwing out of start()', async () => {
    const planningAgentService = { plan: vi.fn().mockRejectedValue(new Error('DeepSeek is unavailable after retries were exhausted.')) };
    const jobService = new PlanAgentJobService(planningAgentService as never);

    let started: { jobId: string; status: 'running' } | undefined;
    expect(() => {
      started = jobService.start('op-3', 'bad rules');
    }).not.toThrow();

    await jobService.whenSettled(started!.jobId);

    const job = jobService.get(started!.jobId);
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('DeepSeek is unavailable after retries were exhausted.');
    expect(job?.errorName).toBe('Error');
  });

  it('get() returns undefined for an unknown jobId', () => {
    const planningAgentService = { plan: vi.fn() };
    const jobService = new PlanAgentJobService(planningAgentService as never);

    expect(jobService.get('does-not-exist')).toBeUndefined();
  });

  it('two calls to start() produce distinct jobIds', () => {
    const planningAgentService = { plan: vi.fn().mockResolvedValue(buildPreview()) };
    const jobService = new PlanAgentJobService(planningAgentService as never);

    const first = jobService.start('op-5', 'rules a');
    const second = jobService.start('op-5', 'rules b');

    expect(first.jobId).not.toBe(second.jobId);
  });
});
