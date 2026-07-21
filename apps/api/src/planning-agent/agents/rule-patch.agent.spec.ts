import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogContext } from '../ports/agent.port';
import { RulePatchAgent } from './rule-patch.agent';

/**
 * multi-agent refactor — `RulePatchAgent`, the second STRUCTURED role-agent
 * (self-correcting-replan-loop's `reviseConstraints`). Mirrors
 * `RuleExtractionAgent` but for revising a previous `ConstraintSet` given the
 * problems it caused.
 */

const catalogContext: CatalogContext = {
  productCodes: ['P-100', 'P-200'],
  families: ['COIL'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};

const previousConstraints = {
  version: 1 as const,
  hardRules: [{ type: 'PRODUCT_ZONE_BAN' as const, productCode: 'P-100', zone: 'CENTER' as never }],
};
const problems = {
  unplaced: [{ productCode: 'P-100', reason: 'No floor space available.' }],
  criticalAlerts: [{ type: 'UNPLACED_ITEM', message: 'Product P-100 unit 1 was not placed.' }],
};

function mockClient(overrides: { chatCompletion?: unknown; chatCompletionWithTools?: unknown } = {}) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(overrides.chatCompletion ?? JSON.stringify({ version: 1, hardRules: [] })),
    chatCompletionWithTools: vi.fn().mockResolvedValue(overrides.chatCompletionWithTools ?? JSON.stringify({ version: 1, hardRules: [] })),
  };
}

describe('RulePatchAgent — json mode (default)', () => {
  it('revises a validated ConstraintSet via plain chatCompletion, using its own model/temperature', async () => {
    const golden = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };
    const client = mockClient({ chatCompletion: JSON.stringify(golden) });
    const agent = new RulePatchAgent(client, 'json', { model: 'revise-model', temperature: 0.4 });

    const result = await agent.revise({ rulesText: 'Do not stack P-100.', previousConstraints, problems, catalogContext });

    expect(result).toEqual(golden);
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
    const [params] = client.chatCompletion.mock.calls[0];
    expect(params.model).toBe('revise-model');
    expect(params.temperature).toBe(0.4);
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content).toContain('REVISING');
  });
});

describe('RulePatchAgent — tooluse mode (opt-in)', () => {
  it('revises a validated ConstraintSet by forcing the set_constraints tool, using its own model/temperature', async () => {
    const golden = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };
    const client = mockClient({ chatCompletionWithTools: JSON.stringify(golden) });
    const agent = new RulePatchAgent(client, 'tooluse', { model: 'revise-model-tooluse', temperature: 0.6 });

    const result = await agent.revise({ rulesText: 'Do not stack P-100.', previousConstraints, problems, catalogContext });

    expect(result).toEqual(golden);
    expect(client.chatCompletionWithTools).toHaveBeenCalledTimes(1);
    const [params] = client.chatCompletionWithTools.mock.calls[0];
    expect(params.model).toBe('revise-model-tooluse');
    expect(params.temperature).toBe(0.6);
    expect(params.toolChoice).toEqual({ type: 'function', function: { name: 'set_constraints' } });
    expect(client.chatCompletion).not.toHaveBeenCalled();
  });
});
