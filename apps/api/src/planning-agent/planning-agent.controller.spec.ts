import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanAgentJobService } from './plan-agent-job.service';
import { PlanningAgentController } from './planning-agent.controller';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm async job flow — HTTP-level tests for the two new
 * job endpoints (`POST .../plan-agent/jobs`, `GET .../plan-agent/jobs/:jobId`),
 * added ALONGSIDE the existing sync `POST .../plan-agent` endpoint (which is
 * covered separately and stays unchanged). `PlanAgentJobService` and
 * `PlanningAgentService` are both mocked — no real solver/DeepSeek/network.
 * Uses a real (ephemeral-port) Nest HTTP server + native `fetch` so the
 * assertions exercise the actual wire-visible status codes, not internal
 * decorator metadata.
 */
describe('PlanningAgentController — async job endpoints', () => {
  let app: INestApplication;
  let baseUrl: string;
  const jobService = { start: vi.fn(), get: vi.fn() };
  const operationId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    jobService.start.mockReset();
    jobService.get.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [PlanningAgentController],
      providers: [
        { provide: PlanningAgentService, useValue: { plan: vi.fn() } },
        { provide: PlanAgentJobService, useValue: jobService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address!.port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST .../plan-agent/jobs calls jobService.start and responds 202 with {jobId,status}', async () => {
    jobService.start.mockReturnValue({ jobId: 'job-abc', status: 'running' });

    const response = await fetch(`${baseUrl}/operations/${operationId}/plan-agent/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rulesText: 'Do not stack anything on top of P-100.' }),
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({ jobId: 'job-abc', status: 'running' });
    expect(jobService.start).toHaveBeenCalledWith(operationId, 'Do not stack anything on top of P-100.');
  });

  it('GET .../plan-agent/jobs/:jobId returns 200 with the job status/result for a known id', async () => {
    jobService.get.mockReturnValue({
      id: 'job-abc',
      operationId,
      status: 'succeeded',
      createdAt: new Date(),
      result: { explanation: 'agent explanation', attempts: 2 },
    });

    const response = await fetch(`${baseUrl}/operations/${operationId}/plan-agent/jobs/job-abc`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('succeeded');
    expect(body.result).toEqual({ explanation: 'agent explanation', attempts: 2 });
    expect(jobService.get).toHaveBeenCalledWith('job-abc');
  });

  it('GET .../plan-agent/jobs/:jobId responds 404 for an unknown jobId', async () => {
    jobService.get.mockReturnValue(undefined);

    const response = await fetch(`${baseUrl}/operations/${operationId}/plan-agent/jobs/does-not-exist`);

    expect(response.status).toBe(404);
  });
});
