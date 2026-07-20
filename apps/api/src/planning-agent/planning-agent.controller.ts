import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { ApiAcceptedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DeepSeekExceptionFilter } from './deepseek-exception.filter';
import { PlanAgentRequestDto } from './dto/plan-agent-request.dto';
import { PlanAgentJobService } from './plan-agent-job.service';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm Phase 8.5 — agent-assisted planning PREVIEW endpoint.
 * Unlike `POST operations/:operationId/loading-plans/generate`
 * (`LoadingPlansController`), this NEVER persists or approves a
 * `LoadingPlan`: it returns a computed-only preview (plan + explanation +
 * applied/dropped-rule report) for the operator to review before running
 * the deterministic generator for real.
 *
 * `@UseFilters(DeepSeekExceptionFilter)` (resilience protocol) — maps
 * `DeepSeekClient`/`DeepSeekJsonAdapter`'s typed errors (timeout, rate limit,
 * exhausted retries) to meaningful HTTP statuses instead of a generic 500.
 *
 * ASYNC job flow — added ALONGSIDE the sync endpoint above (unchanged):
 * the self-correcting re-plan loop can make several sequential DeepSeek
 * calls and exceed 5 minutes, which risks a synchronous HTTP timeout.
 * `POST .../plan-agent/jobs` starts the same `PlanningAgentService.plan()`
 * work in the background (see `PlanAgentJobService`) and returns 202
 * immediately with a `jobId`; `GET .../plan-agent/jobs/:jobId` polls for
 * the result.
 */
@ApiTags('planning-agent')
@Controller()
@UseFilters(DeepSeekExceptionFilter)
export class PlanningAgentController {
  constructor(
    private readonly planningAgentService: PlanningAgentService,
    private readonly planAgentJobService: PlanAgentJobService,
  ) {}

  @Post('operations/:operationId/plan-agent')
  @ApiOkResponse({ description: 'Returns an agent-assisted loading plan PREVIEW for an operation. Does not persist or approve a LoadingPlan.' })
  plan(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: PlanAgentRequestDto) {
    return this.planningAgentService.plan(operationId, dto.rulesText);
  }

  @Post('operations/:operationId/plan-agent/jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({ description: 'Starts the agent-assisted planning PREVIEW in the background and returns a jobId to poll for the result.' })
  startJob(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: PlanAgentRequestDto) {
    return this.planAgentJobService.start(operationId, dto.rulesText);
  }

  @Get('operations/:operationId/plan-agent/jobs/:jobId')
  @ApiOkResponse({ description: 'Returns the status (and result/error once settled) of a background plan-agent job.' })
  @ApiNotFoundResponse({ description: 'No job exists with the given jobId.' })
  async getJob(@Param('operationId', ParseUUIDPipe) operationId: string, @Param('jobId') jobId: string) {
    const job = await this.planAgentJobService.get(jobId);
    if (!job) {
      throw new NotFoundException(`No plan-agent job found for id "${jobId}".`);
    }
    return job;
  }
}
