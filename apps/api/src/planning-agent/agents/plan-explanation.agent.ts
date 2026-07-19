import { EXPLAIN_PLAN_SYSTEM_PROMPT } from '../adapters/deepseek-json.adapter';
import type { DeepSeekChatMessage, DeepSeekClient } from '../adapters/deepseek.client';
import type { DeepSeekAgentRoleConfig } from '../config/deepseek.config';
import type { ExplainPlanParams } from '../ports/agent.port';

/**
 * multi-agent refactor — PlanExplanationAgent, one of the two TEXT
 * role-agents. `explain({ plan, constraints })` produces a human-readable,
 * Spanish explanation of a generated plan — free text, no `ConstraintSet`
 * to validate, so plain `chatCompletion` is enough (no tool needed even for
 * the tool-use adapter kind — mirrors the pre-refactor adapters' own
 * `explainPlan`). Reuses `EXPLAIN_PLAN_SYSTEM_PROMPT` verbatim (exported by
 * `deepseek-json.adapter.ts` for exactly this kind of reuse) and sends its
 * own `DEEPSEEK_MODEL_EXPLAIN`/`DEEPSEEK_TEMPERATURE_EXPLAIN`.
 */
export class PlanExplanationAgent {
  constructor(
    private readonly client: Pick<DeepSeekClient, 'chatCompletion'>,
    private readonly roleConfig: DeepSeekAgentRoleConfig,
  ) {}

  async explain({ plan, constraints }: ExplainPlanParams): Promise<string> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: EXPLAIN_PLAN_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ plan, appliedRules: constraints.hardRules }) },
    ];

    return this.client.chatCompletion({ messages, model: this.roleConfig.model, temperature: this.roleConfig.temperature });
  }
}
