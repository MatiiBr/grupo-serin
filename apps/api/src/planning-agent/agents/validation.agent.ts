import type { ConstraintSet } from '@camiones/shared';
import { VALIDATE_INTENT_SYSTEM_PROMPT, formatCatalogContextLines } from '../adapters/deepseek-json.adapter';
import { parseIntentValidation } from '../adapters/intent-validation-parser';
import type { DeepSeekChatMessage, DeepSeekClient } from '../adapters/deepseek.client';
import type { DeepSeekAgentRoleConfig } from '../config/deepseek.config';
import type { CatalogContext, IntentValidation, ValidateIntentParams } from '../ports/agent.port';

/**
 * VALIDATION agent — the 5th role-agent, ADVISORY ONLY. `validate({
 * rulesText, constraints, catalogContext })` checks whether an
 * already-extracted `ConstraintSet` (produced by `RuleExtractionAgent`/
 * `RulePatchAgent`, a DIFFERENT agent) faithfully reflects the operator's
 * original free-text rules — watching especially for the classic
 * ZONE_RESTRICTION (confine-TO) vs PRODUCT_ZONE_BAN (ban-FROM) inversion,
 * and product/zone misreads. Free text in, but a SMALL structured JSON out
 * (`{ intentMatch, issues }`, not the full `ConstraintSet` schema), so
 * plain `chatCompletion` is enough (no tool needed) — mirrors
 * `DiagnosisAgent`/`PlanExplanationAgent`'s direct-client TEXT style, but
 * the response is parsed via `parseIntentValidation`
 * (`intent-validation-parser.ts`) instead of being returned as raw text.
 * Reuses `VALIDATE_INTENT_SYSTEM_PROMPT`/`formatCatalogContextLines`
 * verbatim (both exported by `deepseek-json.adapter.ts`, the same module
 * that exports the other shared prompts) so the wording can never drift
 * between this agent and the two `AgentPort` adapters' own
 * `validateIntent` implementations. Sends its own
 * `DEEPSEEK_MODEL_VALIDATE`/`DEEPSEEK_TEMPERATURE_VALIDATE`.
 *
 * ADVISORY contract: `PlanningAgentService` MUST surface this agent's
 * result (`intentValidation` on the preview) but MUST NEVER use it to alter
 * the constraints or the generated plan.
 */
export class ValidationAgent {
  constructor(
    private readonly client: Pick<DeepSeekClient, 'chatCompletion'>,
    private readonly roleConfig: DeepSeekAgentRoleConfig,
  ) {}

  async validate({ rulesText, constraints, catalogContext }: ValidateIntentParams): Promise<IntentValidation> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildUserPrompt(rulesText, constraints) },
    ];

    const content = await this.client.chatCompletion({ messages, model: this.roleConfig.model, temperature: this.roleConfig.temperature });
    return parseIntentValidation(content);
  }

  private buildSystemPrompt(catalogContext: CatalogContext): string {
    return [VALIDATE_INTENT_SYSTEM_PROMPT, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildUserPrompt(rulesText: string, constraints: ConstraintSet): string {
    return JSON.stringify({ operatorRules: rulesText, extractedConstraints: constraints.hardRules });
  }
}
