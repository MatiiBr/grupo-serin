import { describe, expect, it } from 'vitest';
import { DeepSeekJsonAdapter } from './adapters/deepseek-json.adapter';
import { DeepSeekToolUseAdapter } from './adapters/deepseek-tool-use.adapter';
import type { DeepSeekClient } from './adapters/deepseek.client';
import { selectAgentPortAdapter } from './planning-agent-port.factory';

/**
 * loading-agent-llm — pure selection factory (`DEEPSEEK_ADAPTER=json|tooluse`
 * -> concrete `AgentPort`), extracted so `PlanningAgentModule`'s
 * `useFactory` stays a one-liner and the selection logic itself is
 * unit-testable without booting Nest's DI container. `'json'` (default)
 * MUST select `DeepSeekJsonAdapter` — nothing changes for existing
 * deployments unless `DEEPSEEK_ADAPTER=tooluse` is set explicitly.
 */

describe('selectAgentPortAdapter', () => {
  const client = {} as DeepSeekClient;

  it('selects DeepSeekJsonAdapter for adapter: "json" (the default)', () => {
    const adapter = selectAgentPortAdapter('json', client);
    expect(adapter).toBeInstanceOf(DeepSeekJsonAdapter);
  });

  it('selects DeepSeekToolUseAdapter for adapter: "tooluse" (opt-in)', () => {
    const adapter = selectAgentPortAdapter('tooluse', client);
    expect(adapter).toBeInstanceOf(DeepSeekToolUseAdapter);
  });
});
