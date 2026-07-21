import type { ConstraintSet } from '@camiones/shared';
import { DeepSeekJsonAdapter } from '../adapters/deepseek-json.adapter';
import { DeepSeekToolUseAdapter } from '../adapters/deepseek-tool-use.adapter';
import type { DeepSeekAdapterKind, DeepSeekAgentRoleConfig } from '../config/deepseek.config';
import type { AgentPort, CatalogContext } from '../ports/agent.port';
import { scopeClientToAgent, type ScopedDeepSeekClient } from './deepseek-model-scoped-client';

/**
 * multi-agent refactor — RuleExtractionAgent, one of the two STRUCTURED
 * role-agents (extraction/patch). `extract(rulesText, catalogContext)` turns
 * free-text operator rules into a validated `ConstraintSet`.
 *
 * Reuses `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter` UNCHANGED — same
 * prompt building, same `parseAndValidateConstraintSet` gate, same
 * `SET_CONSTRAINTS_TOOL` schema (see those modules) — respecting
 * `DEEPSEEK_ADAPTER` exactly like `planning-agent-port.factory.ts`'s
 * `selectAgentPortAdapter`. The ONLY difference from the pre-refactor
 * wiring: the client is scoped (`scopeClientToAgent`) to THIS role's own
 * `DEEPSEEK_MODEL_EXTRACT`/`DEEPSEEK_TEMPERATURE_EXTRACT`, defaulting to the
 * base `DEEPSEEK_MODEL` when unset.
 */
export class RuleExtractionAgent {
  private readonly delegate: Pick<AgentPort, 'planConstraints'>;

  constructor(client: ScopedDeepSeekClient, adapterKind: DeepSeekAdapterKind, roleConfig: DeepSeekAgentRoleConfig) {
    const scopedClient = scopeClientToAgent(client, roleConfig);
    this.delegate = adapterKind === 'tooluse' ? new DeepSeekToolUseAdapter(scopedClient) : new DeepSeekJsonAdapter(scopedClient);
  }

  extract(rulesText: string, catalogContext: CatalogContext): Promise<ConstraintSet> {
    return this.delegate.planConstraints({ rulesText, catalogContext });
  }
}
