import type { ConstraintSet } from '@camiones/shared';
import { DeepSeekJsonAdapter } from '../adapters/deepseek-json.adapter';
import { DeepSeekToolUseAdapter } from '../adapters/deepseek-tool-use.adapter';
import type { DeepSeekAdapterKind, DeepSeekAgentRoleConfig } from '../config/deepseek.config';
import type { AgentPort, ReviseConstraintsParams } from '../ports/agent.port';
import { scopeClientToAgent, type ScopedDeepSeekClient } from './deepseek-model-scoped-client';

/**
 * multi-agent refactor — RulePatchAgent, the second STRUCTURED role-agent
 * (self-correcting-replan-loop's `reviseConstraints`). Given the previous
 * `ConstraintSet` and the concrete problems it caused, proposes an adjusted
 * `ConstraintSet`. Mirrors `RuleExtractionAgent`: reuses
 * `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter` UNCHANGED via a client
 * scoped to its own `DEEPSEEK_MODEL_REVISE`/`DEEPSEEK_TEMPERATURE_REVISE`.
 */
export class RulePatchAgent {
  private readonly delegate: Pick<AgentPort, 'reviseConstraints'>;

  constructor(client: ScopedDeepSeekClient, adapterKind: DeepSeekAdapterKind, roleConfig: DeepSeekAgentRoleConfig) {
    const scopedClient = scopeClientToAgent(client, roleConfig);
    this.delegate = adapterKind === 'tooluse' ? new DeepSeekToolUseAdapter(scopedClient) : new DeepSeekJsonAdapter(scopedClient);
  }

  revise(params: ReviseConstraintsParams): Promise<ConstraintSet> {
    return this.delegate.reviseConstraints(params);
  }
}
