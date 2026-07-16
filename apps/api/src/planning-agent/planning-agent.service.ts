import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ConstraintSet, HardRule } from '@camiones/shared';
import { applyConstraints } from '../domain/loading-planner/constraint-application';
import { HeuristicLoadingPlanner } from '../domain/loading-planner/heuristic-loading-planner';
import type { LoadingPlannerResult } from '../domain/loading-planner/loading-planner.types';
import { operationToPlannerInput, OperationForPlannerInput } from '../loading-plans/operation-to-planner-input';
import { PrismaService } from '../prisma/prisma.service';
import { AGENT_PORT, type AgentPort, type CatalogContext } from './ports/agent.port';
import { ConstraintSetStructuralError, DroppedRule, validateConstraintSet } from './validate-constraint-set';

/**
 * loading-agent-llm Phase 8 — orchestrates the agent-assisted planning
 * PREVIEW: fetch operation -> map to planner input -> build catalog context
 * -> `agentPort.planConstraints` -> Phase 7 validation gate ->
 * `applyConstraints` -> `planner.generate` (unchanged) -> `agentPort.explainPlan`
 * -> return the preview. Deliberately never touches `prisma.loadingPlan` —
 * this is a computed-only preview, never persisted or approved (spec's
 * "Preview Semantics" requirement).
 */

export interface PlanningAgentPreview {
  plan: LoadingPlannerResult;
  explanation: string;
  appliedRules: HardRule[];
  droppedRules: DroppedRule[];
}

@Injectable()
export class PlanningAgentService {
  private readonly planner = new HeuristicLoadingPlanner();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENT_PORT) private readonly agentPort: AgentPort,
  ) {}

  async plan(operationId: string, rulesText: string): Promise<PlanningAgentPreview> {
    const operation = await this.prisma.loadOperation.findUnique({
      where: { id: operationId },
      include: {
        truck: { include: { zones: true, tiers: true } },
        destinations: { orderBy: { unloadingOrder: 'asc' } },
        products: { include: { destination: true }, orderBy: { createdAt: 'asc' } },
        plans: { orderBy: { version: 'desc' }, take: 1, select: { version: true } },
      },
    });

    if (!operation) {
      throw new NotFoundException('Operation not found.');
    }

    if (!operation.truck) {
      throw new BadRequestException('Operation must have a truck before planning with the agent.');
    }

    if (!operation.truck.lengthMm || !operation.truck.widthMm || !operation.truck.heightMm) {
      throw new BadRequestException('Truck length, width, and height are required for agent-assisted planning.');
    }

    if (operation.products.length === 0) {
      throw new BadRequestException('Operation must have at least one product before planning with the agent.');
    }

    const plannerInput = operationToPlannerInput(operation);
    const catalogContext = this.buildCatalogContext(operation);

    const rawConstraintSet = await this.agentPort.planConstraints({ rulesText, catalogContext });
    const { appliedRules, droppedRules } = await this.runValidationGate(rawConstraintSet, catalogContext);

    const constraintSet: ConstraintSet = { version: 1, hardRules: appliedRules };
    const transformedInput = applyConstraints(plannerInput, constraintSet);
    const plan = this.planner.generate(transformedInput);
    const explanation = await this.agentPort.explainPlan({ plan, constraints: constraintSet });

    return { plan, explanation, appliedRules, droppedRules };
  }

  private async runValidationGate(rawConstraintSet: ConstraintSet, catalogContext: CatalogContext) {
    try {
      return await validateConstraintSet(rawConstraintSet, catalogContext);
    } catch (error) {
      if (error instanceof ConstraintSetStructuralError) {
        throw new BadRequestException('The agent returned a constraint set that failed structural validation.');
      }
      throw error;
    }
  }

  private buildCatalogContext(operation: OperationForPlannerInput): CatalogContext {
    return {
      productCodes: [...new Set(operation.products.map((product) => product.code))],
      families: [...new Set(operation.products.map((product) => product.family))],
      zones: [...new Set(operation.truck!.zones.map((zone) => zone.type))],
      destinations: [...new Set(operation.destinations.map((destination) => destination.name))],
    };
  }
}
