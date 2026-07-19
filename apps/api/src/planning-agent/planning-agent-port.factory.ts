import { DeepSeekJsonAdapter } from './adapters/deepseek-json.adapter';
import { DeepSeekToolUseAdapter } from './adapters/deepseek-tool-use.adapter';
import type { DeepSeekClient } from './adapters/deepseek.client';
import type { DeepSeekAdapterKind } from './config/deepseek.config';
import type { AgentPort } from './ports/agent.port';

/**
 * loading-agent-llm — pure `DEEPSEEK_ADAPTER` -> `AgentPort` selection,
 * extracted out of `PlanningAgentModule`'s `useFactory` so the selection
 * itself is unit-testable without booting Nest's DI container. `'json'`
 * (the default — see `deepseek.config.ts`) selects `DeepSeekJsonAdapter`;
 * `'tooluse'` (opt-in, real OpenAI-compatible tool/function-calling, gated
 * on unverified Huawei Cloud DeepSeek tool-calling support) selects
 * `DeepSeekToolUseAdapter`. Both are built from the SAME `DeepSeekClient`.
 */
export function selectAgentPortAdapter(adapter: DeepSeekAdapterKind, client: DeepSeekClient): AgentPort {
  if (adapter === 'tooluse') {
    return new DeepSeekToolUseAdapter(client);
  }

  return new DeepSeekJsonAdapter(client);
}
