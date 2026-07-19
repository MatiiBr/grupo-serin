import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { DeepSeekClient } from '../adapters/deepseek.client';
import type { DeepSeekAgentsConfig } from '../config/deepseek.config';
import { buildAgentTeam } from './agent-team.factory';
import { AgentTeam } from './agent-team';

/**
 * multi-agent refactor — `buildAgentTeam` wires a real `DeepSeekClient` +
 * `deepseekConfig`'s `adapter`/`agents` namespace into a fully-formed
 * `AgentTeam` (the four role-agents, each scoped to its own model/temperature).
 * This is what `PlanningAgentModule`'s `AGENT_PORT` provider calls instead of
 * the pre-refactor `selectAgentPortAdapter`.
 */

function mockClient() {
  return {
    chatCompletion: vi.fn().mockResolvedValue(JSON.stringify({ version: 1, hardRules: [] })),
    chatCompletionWithTools: vi.fn().mockResolvedValue(JSON.stringify({ version: 1, hardRules: [] })),
  } as unknown as DeepSeekClient;
}

const agentsConfig: DeepSeekAgentsConfig = {
  extract: { model: 'deepseek-chat' },
  revise: { model: 'deepseek-chat' },
  explain: { model: 'deepseek-chat' },
  diagnose: { model: 'deepseek-chat' },
};

describe('buildAgentTeam', () => {
  it('returns an AgentTeam instance', () => {
    const team = buildAgentTeam(mockClient(), 'json', agentsConfig);
    expect(team).toBeInstanceOf(AgentTeam);
  });

  it('the built AgentTeam can serve every AgentPort method end-to-end (json mode)', async () => {
    const client = mockClient();
    const team = buildAgentTeam(client, 'json', agentsConfig);

    const catalogContext = { productCodes: ['P-100'], families: ['COIL'], zones: ['CENTER'], destinations: ['dest-1'] };
    const constraints = await team.planConstraints({ rulesText: 'r', catalogContext });
    expect(constraints).toEqual({ version: 1, hardRules: [] });

    (client.chatCompletion as ReturnType<typeof vi.fn>).mockResolvedValueOnce('explanation');
    const explanation = await team.explainPlan({ plan: {} as never, constraints });
    expect(explanation).toBe('explanation');
  });

  it('the built AgentTeam uses tool-use for the structured methods when adapterKind is "tooluse"', async () => {
    const client = mockClient();
    const team = buildAgentTeam(client, 'tooluse', agentsConfig);

    await team.planConstraints({ rulesText: 'r', catalogContext: { productCodes: [], families: [], zones: [], destinations: [] } });

    expect(client.chatCompletionWithTools).toHaveBeenCalledTimes(1);
    expect(client.chatCompletion).not.toHaveBeenCalled();
  });
});
