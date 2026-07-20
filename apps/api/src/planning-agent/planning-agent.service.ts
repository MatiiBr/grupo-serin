import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { ConstraintSet, HardRule } from '@camiones/shared';
import { applyConstraints } from '../domain/loading-planner/constraint-application';
import { HeuristicLoadingPlanner } from '../domain/loading-planner/heuristic-loading-planner';
import type { LoadingPlannerInput, LoadingPlannerResult } from '../domain/loading-planner/loading-planner.types';
import { operationToPlannerInput, OperationForPlannerInput } from '../loading-plans/operation-to-planner-input';
import { PrismaService } from '../prisma/prisma.service';
import { deepseekConfig } from './config/deepseek.config';
import { AGENT_PORT, type AgentPort, type CatalogContext, type IntentValidation, type PlanProblems } from './ports/agent.port';
import { ConstraintSetStructuralError, DroppedRule, validateConstraintSet } from './validate-constraint-set';

/**
 * loading-agent-llm Phase 8 + self-correcting-replan-loop — orchestrates the
 * agent-assisted planning PREVIEW: fetch operation -> map to planner input
 * -> build catalog context -> `agentPort.planConstraints` -> Phase 7
 * validation gate -> `applyConstraints` -> `planner.generate` (unchanged) ->
 * repeat via `agentPort.reviseConstraints` while the plan leaves units
 * unplaced or raises CRITICAL alerts (warnings never trigger a retry), up to
 * `maxPlanAttempts` -> `agentPort.explainPlan` on the BEST attempt seen ->
 * return the preview. Deliberately never touches `prisma.loadingPlan` — this
 * is a computed-only preview, never persisted or approved (spec's "Preview
 * Semantics" requirement) — across every attempt of the loop, not just the
 * first.
 *
 * DIAGNOSIS agent — after the loop, if the BEST attempt is still NOT clean
 * (unplaced items and/or critical alerts survive after `maxPlanAttempts`),
 * `agentPort.diagnoseUnresolvedPlan` is called once and its plain-language
 * Spanish diagnosis is included as `diagnosis` in the preview. If the BEST
 * attempt IS clean, `diagnoseUnresolvedPlan` is never called and `diagnosis`
 * is omitted. `explainPlan` still runs on the best plan either way.
 *
 * VALIDATION agent — ADVISORY ONLY. `agentPort.validateIntent` is called
 * exactly ONCE per `plan()` call, right after attempt 1's gate-validated
 * `ConstraintSet` is known (i.e. on the FIRST successful extraction that
 * captures the operator's intent), BEFORE any self-correcting-replan-loop
 * revision. Its result is surfaced as `intentValidation` on the preview but
 * is NEVER used to alter the applied constraints or the generated plan —
 * later attempts' revised constraints are never re-checked. Skipped (and
 * `intentValidation` omitted) when attempt 1 applies zero rules — there is
 * nothing to check the extracted intent against.
 */

export interface ResolutionLogEntry {
  attempt: number;
  unplaced: number;
  critical: number;
  revised: boolean;
}

export interface PlanningAgentPreview {
  plan: LoadingPlannerResult;
  explanation: string;
  appliedRules: HardRule[];
  droppedRules: DroppedRule[];
  attempts: number;
  resolutionLog: ResolutionLogEntry[];
  /**
   * DIAGNOSIS agent — present ONLY when the BEST attempt is not clean
   * (unplaced items and/or critical alerts). Absent when the plan is clean.
   */
  diagnosis?: string;
  /**
   * VALIDATION agent — ADVISORY ONLY, present ONLY when attempt 1 applied at
   * least one rule (otherwise there is nothing to check intent against, see
   * `runIntentValidation`). Never used to alter `appliedRules`/`plan`.
   */
  intentValidation?: IntentValidation;
}

interface PlanAttempt {
  constraintSet: ConstraintSet;
  appliedRules: HardRule[];
  droppedRules: DroppedRule[];
  plan: LoadingPlannerResult;
  problems: PlanProblems;
}

@Injectable()
export class PlanningAgentService {
  private readonly planner = new HeuristicLoadingPlanner();
  private readonly maxPlanAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENT_PORT) private readonly agentPort: AgentPort,
    @Inject(deepseekConfig.KEY) config: ConfigType<typeof deepseekConfig> = deepseekConfig(),
  ) {
    this.maxPlanAttempts = config.maxPlanAttempts;
  }

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

    const { best, resolutionLog, intentValidation } = await this.runPlanningLoop(rulesText, plannerInput, catalogContext);
    const explanation = await this.agentPort.explainPlan({ plan: best.plan, constraints: best.constraintSet });

    const preview: PlanningAgentPreview = {
      plan: best.plan,
      explanation,
      appliedRules: best.appliedRules,
      droppedRules: best.droppedRules,
      attempts: resolutionLog.length,
      resolutionLog,
    };

    if (intentValidation) {
      preview.intentValidation = intentValidation;
    }

    const isClean = best.problems.unplaced.length === 0 && best.problems.criticalAlerts.length === 0;
    if (!isClean) {
      preview.diagnosis = await this.agentPort.diagnoseUnresolvedPlan({
        rulesText,
        constraints: best.constraintSet,
        plan: best.plan,
        problems: best.problems,
        catalogContext,
      });
    }

    return preview;
  }

  /**
   * self-correcting-replan-loop — attempt 1 always calls `planConstraints`;
   * every subsequent attempt (up to `maxPlanAttempts`) calls
   * `reviseConstraints` with a structured summary of what went wrong. Every
   * attempt's raw `ConstraintSet` goes back through the Phase 7 validation
   * gate (hallucinated refs are dropped again, never trusted from a prior
   * pass). The BEST attempt (fewest unplaced units, tie-broken by fewest
   * critical alerts) is kept even if the loop never converges to a fully
   * clean plan.
   */
  private async runPlanningLoop(rulesText: string, plannerInput: LoadingPlannerInput, catalogContext: CatalogContext) {
    const resolutionLog: ResolutionLogEntry[] = [];
    let best: PlanAttempt | undefined;
    let intentValidation: IntentValidation | undefined;
    let rawConstraintSet = await this.agentPort.planConstraints({ rulesText, catalogContext });

    for (let attempt = 1; attempt <= this.maxPlanAttempts; attempt += 1) {
      const current = await this.runAttempt(rawConstraintSet, plannerInput, catalogContext);
      if (!best || this.isBetterAttempt(current, best)) {
        best = current;
      }

      if (attempt === 1) {
        intentValidation = await this.runIntentValidation(rulesText, current.constraintSet, catalogContext);
      }

      const clean = current.problems.unplaced.length === 0 && current.problems.criticalAlerts.length === 0;
      const willRevise = !clean && attempt < this.maxPlanAttempts;
      resolutionLog.push({
        attempt,
        unplaced: current.problems.unplaced.length,
        critical: current.problems.criticalAlerts.length,
        revised: willRevise,
      });

      if (!willRevise) break;

      rawConstraintSet = await this.agentPort.reviseConstraints({
        rulesText,
        previousConstraints: current.constraintSet,
        problems: current.problems,
        catalogContext,
      });
    }

    return { best: best!, resolutionLog, intentValidation };
  }

  /**
   * VALIDATION agent — ADVISORY ONLY, called exactly once per `plan()`, on
   * attempt 1's gate-validated `ConstraintSet` (the constraints that capture
   * the operator's intent), before any re-plan-loop revision. Skipped when
   * attempt 1 applies zero rules — there is nothing to check an extracted
   * intent against, and every existing "no rules" scenario stays a
   * single plain `planConstraints`+`explainPlan` call, unchanged.
   */
  private async runIntentValidation(
    rulesText: string,
    constraints: ConstraintSet,
    catalogContext: CatalogContext,
  ): Promise<IntentValidation | undefined> {
    if (constraints.hardRules.length === 0) return undefined;
    return this.agentPort.validateIntent({ rulesText, constraints, catalogContext });
  }

  private async runAttempt(
    rawConstraintSet: ConstraintSet,
    plannerInput: LoadingPlannerInput,
    catalogContext: CatalogContext,
  ): Promise<PlanAttempt> {
    const { appliedRules, droppedRules } = await this.runValidationGate(rawConstraintSet, catalogContext);
    const constraintSet: ConstraintSet = { version: 1, hardRules: appliedRules };
    const transformedInput = applyConstraints(plannerInput, constraintSet);
    const plan = this.planner.generate(transformedInput);
    const problems = this.computeProblems(plan, plannerInput);

    return { constraintSet, appliedRules, droppedRules, plan, problems };
  }

  /** Fewest unplaced units wins; ties are broken by fewest critical alerts. */
  private isBetterAttempt(candidate: PlanAttempt, current: PlanAttempt): boolean {
    if (candidate.problems.unplaced.length !== current.problems.unplaced.length) {
      return candidate.problems.unplaced.length < current.problems.unplaced.length;
    }
    return candidate.problems.criticalAlerts.length < current.problems.criticalAlerts.length;
  }

  private computeProblems(plan: LoadingPlannerResult, plannerInput: LoadingPlannerInput): PlanProblems {
    const codeById = new Map(plannerInput.products.map((product) => [product.id, product.code]));

    return {
      unplaced: plan.unplacedItems.map((item) => ({
        productCode: codeById.get(item.productId) ?? item.productId,
        reason: item.message,
      })),
      criticalAlerts: plan.alerts
        .filter((alert) => alert.severity === 'CRITICAL')
        .map((alert) => ({ type: alert.type, message: alert.message })),
    };
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
