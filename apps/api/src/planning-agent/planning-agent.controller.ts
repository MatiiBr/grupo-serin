import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PlanAgentRequestDto } from './dto/plan-agent-request.dto';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm Phase 8.5 — agent-assisted planning PREVIEW endpoint.
 * Unlike `POST operations/:operationId/loading-plans/generate`
 * (`LoadingPlansController`), this NEVER persists or approves a
 * `LoadingPlan`: it returns a computed-only preview (plan + explanation +
 * applied/dropped-rule report) for the operator to review before running
 * the deterministic generator for real.
 */
@ApiTags('planning-agent')
@Controller()
export class PlanningAgentController {
  constructor(private readonly planningAgentService: PlanningAgentService) {}

  @Post('operations/:operationId/plan-agent')
  @ApiOkResponse({ description: 'Returns an agent-assisted loading plan PREVIEW for an operation. Does not persist or approve a LoadingPlan.' })
  plan(@Param('operationId', ParseUUIDPipe) operationId: string, @Body() dto: PlanAgentRequestDto) {
    return this.planningAgentService.plan(operationId, dto.rulesText);
  }
}
