import { ProductFamily, TruckZoneType, type ConstraintSet } from '@camiones/shared';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';
import type {
  AgentPort,
  CatalogContext,
  DiagnoseUnresolvedPlanParams,
  ExplainPlanParams,
  IntentValidation,
  PlanConstraintsParams,
  PlanProblems,
  ReviseConstraintsParams,
  ValidateIntentParams,
} from '../ports/agent.port';
import { parseAndValidateConstraintSet } from './constraint-set-parser';
import {
  DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT,
  EXPLAIN_PLAN_SYSTEM_PROMPT,
  formatCatalogContextLines,
  REVISION_SYSTEM_PROMPT_ADDENDUM,
  SYSTEM_PROMPT_HEADER,
  VALIDATE_INTENT_SYSTEM_PROMPT,
} from './deepseek-json.adapter';
import { DeepSeekNoToolCallError, type DeepSeekChatMessage, type DeepSeekClient, type DeepSeekToolDefinition } from './deepseek.client';
import { parseIntentValidation } from './intent-validation-parser';

/**
 * loading-agent-llm — REAL `AgentPort` implementation using OpenAI-compatible
 * native tool/function-calling (`chatCompletionWithTools`). NOT the default
 * `AgentPort` — `DeepSeekJsonAdapter` is (see its module docstring and
 * design.md's "JSON-mode adapter default"). Huawei Cloud's DeepSeek endpoint
 * tool-calling support is UNVERIFIED against the real API; this adapter is
 * OPT-IN via `DEEPSEEK_ADAPTER=tooluse` (see `deepseek.config.ts` +
 * `planning-agent.module.ts`'s selection factory). If the endpoint does not
 * actually honor `tools`/`tool_choice` at runtime (e.g. it silently ignores
 * them and answers with prose, or 400s), `DeepSeekClient` surfaces a
 * `DeepSeekNoToolCallError` / non-2xx status, which this adapter wraps into
 * a `DeepSeekToolUseUnsupportedError` — a clear, typed signal to fall back to
 * `DEEPSEEK_ADAPTER=json` (the safe default) rather than a confusing crash.
 *
 * `planConstraints`/`reviseConstraints` force the model to call
 * `SET_CONSTRAINTS_TOOL` (`tool_choice: { type: 'function', function: { name:
 * 'set_constraints' } }`) so structure is enforced by the function's JSON
 * schema rather than free-form JSON-mode prose. The tool call's
 * `arguments` string goes through the EXACT same
 * `parseAndValidateConstraintSet` gate as `DeepSeekJsonAdapter` (see
 * `constraint-set-parser.ts`) — same typed errors
 * (`ConstraintSetParseError`/`ConstraintSetValidationError`) on
 * malformed/schema-invalid arguments. System prompts reuse
 * `SYSTEM_PROMPT_HEADER`/`REVISION_SYSTEM_PROMPT_ADDENDUM`/
 * `formatCatalogContextLines` from `deepseek-json.adapter.ts` so the rule
 * schema wording and catalog injection can never drift between the two
 * adapters. `explainPlan` needs no structured output, so it reuses plain
 * `chatCompletion` with the same Spanish system prompt as the JSON adapter.
 *
 * DIAGNOSIS agent — `diagnoseUnresolvedPlan` mirrors `explainPlan`: free
 * text, no tool needed, plain `chatCompletion`, sharing
 * `DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT` (imported from
 * `deepseek-json.adapter.ts`) so both adapters give the operator the exact
 * same diagnostician framing.
 */

const SET_CONSTRAINTS_TOOL_NAME = 'set_constraints';

/**
 * OpenAI-compatible function-tool JSON-schema mirror of `ConstraintSet`
 * (`ConstraintSetDto`'s 6 discriminated hard-rule shapes, exact field
 * names). The model MUST return the `ConstraintSet` by CALLING this tool —
 * `tool_choice` in `callSetConstraintsTool` forces it — rather than emitting
 * free JSON, so structure is enforced by the function schema itself.
 */
export const SET_CONSTRAINTS_TOOL: DeepSeekToolDefinition = {
  type: 'function',
  function: {
    name: SET_CONSTRAINTS_TOOL_NAME,
    description:
      'Return the ConstraintSet of hard placement rules extracted from the operator instructions. You MUST call this function with the extracted rules — never answer with plain text.',
    parameters: {
      type: 'object',
      required: ['version', 'hardRules'],
      additionalProperties: false,
      properties: {
        version: { const: 1, description: 'Schema version. Always the literal 1.' },
        hardRules: {
          type: 'array',
          description:
            'Hard placement rules. Each item MUST match EXACTLY ONE of the 6 shapes below, using these EXACT field names — the truck-zone field is ALWAYS "zone", never a synonym like "restrictedZone".',
          items: {
            oneOf: [
              {
                type: 'object',
                required: ['type', 'productCode'],
                additionalProperties: false,
                properties: {
                  type: { const: 'STACKING_PROHIBITION' },
                  productCode: { type: 'string', description: 'A single product code from the known catalog.' },
                },
              },
              {
                type: 'object',
                required: ['type', 'productCode'],
                additionalProperties: false,
                properties: {
                  type: { const: 'FRAGILE_ON_TOP' },
                  productCode: { type: 'string' },
                },
              },
              {
                type: 'object',
                required: ['type', 'productCode', 'zone'],
                additionalProperties: false,
                properties: {
                  type: { const: 'ZONE_RESTRICTION' },
                  productCode: { type: 'string' },
                  zone: {
                    type: 'string',
                    enum: Object.values(TruckZoneType),
                    description: 'CONFINES the product TO this zone — the product may ONLY go here.',
                  },
                },
              },
              {
                type: 'object',
                required: ['type', 'productCode', 'maxTier'],
                additionalProperties: false,
                properties: {
                  type: { const: 'TIER_RESTRICTION' },
                  productCode: { type: 'string' },
                  maxTier: { type: 'integer', minimum: 1, description: 'Max stacking tier; 1 = ground tier.' },
                },
              },
              {
                type: 'object',
                required: ['type', 'family', 'zone'],
                additionalProperties: false,
                properties: {
                  type: { const: 'FAMILY_PLACEMENT_BAN' },
                  family: { type: 'string', enum: Object.values(ProductFamily) },
                  zone: { type: 'string', enum: Object.values(TruckZoneType) },
                },
              },
              {
                type: 'object',
                required: ['type', 'productCode', 'zone'],
                additionalProperties: false,
                properties: {
                  type: { const: 'PRODUCT_ZONE_BAN' },
                  productCode: { type: 'string' },
                  zone: {
                    type: 'string',
                    enum: Object.values(TruckZoneType),
                    description: 'BANS the product FROM this zone (opposite of ZONE_RESTRICTION); the product may go anywhere else.',
                  },
                },
              },
            ],
          },
        },
        notes: { type: 'string', description: 'Optional free-text note.' },
      },
    },
  },
};

/**
 * Typed error for the "this adapter's tool-use flow did not work at
 * runtime" path — either the client explicitly reported no `tool_calls`
 * (`DeepSeekNoToolCallError`), or the endpoint otherwise rejects `tools`.
 * Signals to the operator/orchestrator: fall back to
 * `DEEPSEEK_ADAPTER=json`.
 */
export class DeepSeekToolUseUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeepSeekToolUseUnsupportedError';
  }
}

export class DeepSeekToolUseAdapter implements AgentPort {
  constructor(private readonly client: Pick<DeepSeekClient, 'chatCompletion' | 'chatCompletionWithTools'>) {}

  async planConstraints({ rulesText, catalogContext }: PlanConstraintsParams): Promise<ConstraintSet> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(catalogContext) },
      { role: 'user', content: rulesText },
    ];

    return this.callSetConstraintsTool(messages);
  }

  async reviseConstraints({ rulesText, previousConstraints, problems, catalogContext }: ReviseConstraintsParams): Promise<ConstraintSet> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildRevisionSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildRevisionUserPrompt(rulesText, previousConstraints, problems) },
    ];

    return this.callSetConstraintsTool(messages);
  }

  async explainPlan({ plan, constraints }: ExplainPlanParams): Promise<string> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: EXPLAIN_PLAN_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ plan, appliedRules: constraints.hardRules }) },
    ];

    return this.client.chatCompletion({ messages });
  }

  /**
   * DIAGNOSIS agent — free-text output, no tool needed even on this
   * tool-use adapter, so it reuses plain `chatCompletion` with the exact
   * same Spanish diagnostician system prompt as `DeepSeekJsonAdapter`.
   */
  async diagnoseUnresolvedPlan({ rulesText, constraints, plan, problems, catalogContext }: DiagnoseUnresolvedPlanParams): Promise<string> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildDiagnosisSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildDiagnosisUserPrompt(rulesText, constraints, problems, plan) },
    ];

    return this.client.chatCompletion({ messages });
  }

  /**
   * VALIDATION agent — ADVISORY ONLY, small JSON payload (not a
   * `ConstraintSet`), no tool needed even on this tool-use adapter — plain
   * `chatCompletion` with the exact same Spanish reviewer system prompt as
   * `DeepSeekJsonAdapter`, parsed via `parseIntentValidation`.
   */
  async validateIntent({ rulesText, constraints, catalogContext }: ValidateIntentParams): Promise<IntentValidation> {
    const messages: DeepSeekChatMessage[] = [
      { role: 'system', content: this.buildValidateIntentSystemPrompt(catalogContext) },
      { role: 'user', content: this.buildValidateIntentUserPrompt(rulesText, constraints) },
    ];

    const content = await this.client.chatCompletion({ messages });
    return parseIntentValidation(content);
  }

  /** Forces `SET_CONSTRAINTS_TOOL` via `tool_choice`, then runs the arguments through the shared parse+validate gate. */
  private async callSetConstraintsTool(messages: DeepSeekChatMessage[]): Promise<ConstraintSet> {
    let argumentsJson: string;

    try {
      argumentsJson = await this.client.chatCompletionWithTools({
        messages,
        tools: [SET_CONSTRAINTS_TOOL],
        toolChoice: { type: 'function', function: { name: SET_CONSTRAINTS_TOOL_NAME } },
      });
    } catch (error) {
      if (error instanceof DeepSeekNoToolCallError) {
        throw new DeepSeekToolUseUnsupportedError(
          `DeepSeek did not return a "${SET_CONSTRAINTS_TOOL_NAME}" tool call — the endpoint may not support tool/function calling. Fall back to DEEPSEEK_ADAPTER=json. Original error: ${error.message}`,
        );
      }
      throw error;
    }

    return parseAndValidateConstraintSet(argumentsJson);
  }

  private buildSystemPrompt(catalogContext: CatalogContext): string {
    return [SYSTEM_PROMPT_HEADER, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildRevisionSystemPrompt(catalogContext: CatalogContext): string {
    return [SYSTEM_PROMPT_HEADER, REVISION_SYSTEM_PROMPT_ADDENDUM, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildRevisionUserPrompt(rulesText: string, previousConstraints: ConstraintSet, problems: PlanProblems): string {
    return JSON.stringify({
      operatorRules: rulesText,
      previousConstraints,
      problems,
    });
  }

  /** DIAGNOSIS agent — same catalog-injection convention as the other prompts. */
  private buildDiagnosisSystemPrompt(catalogContext: CatalogContext): string {
    return [DIAGNOSE_UNRESOLVED_PLAN_SYSTEM_PROMPT, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildDiagnosisUserPrompt(
    rulesText: string,
    constraints: ConstraintSet,
    problems: PlanProblems,
    plan: LoadingPlannerResult,
  ): string {
    return JSON.stringify({
      operatorRules: rulesText,
      appliedRules: constraints.hardRules,
      problems,
      planMetrics: plan.metrics,
    });
  }

  /** VALIDATION agent — same catalog-injection convention as the other prompts. */
  private buildValidateIntentSystemPrompt(catalogContext: CatalogContext): string {
    return [VALIDATE_INTENT_SYSTEM_PROMPT, ...formatCatalogContextLines(catalogContext)].join('\n');
  }

  private buildValidateIntentUserPrompt(rulesText: string, constraints: ConstraintSet): string {
    return JSON.stringify({
      operatorRules: rulesText,
      extractedConstraints: constraints.hardRules,
    });
  }
}
