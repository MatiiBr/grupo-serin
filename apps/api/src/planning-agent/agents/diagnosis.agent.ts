import type { ConstraintSet } from '@camiones/shared';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import { DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT, formatCatalogContextLines } from '../adapters/deepseek-json.adapter';
import type { DeepSeekChatMessage, DeepSeekClient } from '../adapters/deepseek.client';
import type { DeepSeekAgentRoleConfig } from '../config/deepseek.config';
import type { CatalogContext, DiagnoseUnresolvedPlanParams, PlanProblems } from '../ports/agent.port';

/**
 * multi-agent refactor — DiagnosisAgent, the second TEXT role-agent. Called
 * ONLY when the self-correcting re-plan loop's BEST attempt is still not
 * clean after `maxPlanAttempts`. Free text, no tool needed, so plain
 * `chatCompletion` — mirrors the pre-refactor adapters' own
 * `diagnoseUnresolvedPlan`, reusing `DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT`
 * and `formatCatalogContextLines` verbatim (both exported by
 * `deepseek-json.adapter.ts` for exactly this kind of reuse). Sends its own
 * `DEEPSEEK_MODEL_DIAGNOSE`/`DEEPSEEK_TEMPERATURE_DIAGNOSE`.
 */
export class DiagnosisAgent {
  constructor(
    private readonly client: Pick<DeepSeekClient, 'chatCompletion'>,
    private readonly roleConfig: DeepSeekAgentRoleConfig,
  ) {}

  async diagnose({ rulesText, constraints, plan, problems, catalogContext }: DiagnoseUnresolvedPlanParams): Promise<string> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildUserPrompt(rulesText, constraints, problems, plan) },
    ];

    return this.client.chatCompletion({ messages, model: this.roleConfig.model, temperature: this.roleConfig.temperature });
  }

  private buildSystemPrompt(catalogContext: CatalogContext): string {
    return [DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildUserPrompt(rulesText: string, constraints: ConstraintSet, problems: PlanProblems, plan: LoadingPlannerResult): string {
    return JSON.stringify({
      operatorRules: rulesText,
      appliedRules: constraints.hardRules,
      problems,
      planMetrics: plan.metrics,
    });
  }
}
