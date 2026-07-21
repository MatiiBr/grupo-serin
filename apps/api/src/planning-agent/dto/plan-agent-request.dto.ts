import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * loading-agent-llm Phase 8.1 — request body for
 * `POST operations/:operationId/plan-agent`. Free-text operator rules that
 * `AgentPort.planConstraints` turns into a structured `ConstraintSet`.
 */
export class PlanAgentRequestDto {
  @ApiProperty({ example: 'Do not stack anything on top of P-100. Keep COIL products out of the CABIN_SIDE zone.' })
  @IsString()
  @MinLength(1)
  rulesText!: string;
}
