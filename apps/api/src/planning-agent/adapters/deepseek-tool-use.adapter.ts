import type { ConstraintSet } from '@camiones/shared';
import type { AgentPort, ExplainPlanParams, PlanConstraintsParams, ReviseConstraintsParams } from '../ports/agent.port';
import type { DeepSeekClient } from './deepseek.client';

/**
 * loading-agent-llm Phase 6.4 — EXPERIMENTAL scaffold. NOT wired as the
 * default `AgentPort` (`DeepSeekJsonAdapter` is — see its module docstring
 * and design.md's "JSON-mode adapter default"). design.md gates a real
 * implementation on "only if Huawei function-calling verified" — that
 * verification has not happened, so both methods below reject with a typed
 * error rather than guessing at an unconfirmed wire format. The tool schema
 * mirroring `ConstraintSet` is documented here so the real implementation
 * can be dropped in later without redesigning the contract.
 */

/** JSON-Schema mirror of `ConstraintSet`, ready for a future `tools: [...]` payload once tool-calling is verified against the real Huawei Cloud DeepSeek endpoint. */
export const CONSTRAINT_SET_TOOL_SCHEMA = {
  name: 'propose_constraints',
  description: 'Propose the ConstraintSet of hard loading rules extracted from the operator instructions.',
  parameters: {
    type: 'object',
    required: ['version', 'hardRules'],
    properties: {
      version: { const: 1 },
      hardRules: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              enum: ['STACKING_PROHIBITION', 'FRAGILE_ON_TOP', 'ZONE_RESTRICTION', 'TIER_RESTRICTION', 'FAMILY_PLACEMENT_BAN'],
            },
            productCode: { type: 'string' },
            family: { type: 'string' },
            zone: { type: 'string' },
            maxTier: { type: 'integer', minimum: 1 },
          },
        },
      },
      notes: { type: 'string' },
    },
  },
} as const;

export class DeepSeekToolUseUnsupportedError extends Error {
  constructor(method: 'planConstraints' | 'explainPlan' | 'reviseConstraints') {
    super(
      `DeepSeekToolUseAdapter.${method} is experimental and not yet supported: Huawei Cloud's DeepSeek tool/function-calling ` +
        'support has not been verified against the real API. Use DeepSeekJsonAdapter (the default AgentPort) instead.',
    );
    this.name = 'DeepSeekToolUseUnsupportedError';
  }
}

export class DeepSeekToolUseAdapter implements AgentPort {
  constructor(private readonly client: Pick<DeepSeekClient, 'chatCompletion'>) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by AgentPort; unconditional stub today, see class docstring.
  async planConstraints(params: PlanConstraintsParams): Promise<ConstraintSet> {
    throw new DeepSeekToolUseUnsupportedError('planConstraints');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by AgentPort; unconditional stub today, see class docstring.
  async explainPlan(params: ExplainPlanParams): Promise<string> {
    throw new DeepSeekToolUseUnsupportedError('explainPlan');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by AgentPort; unconditional stub today, see class docstring.
  async reviseConstraints(params: ReviseConstraintsParams): Promise<ConstraintSet> {
    throw new DeepSeekToolUseUnsupportedError('reviseConstraints');
  }
}
