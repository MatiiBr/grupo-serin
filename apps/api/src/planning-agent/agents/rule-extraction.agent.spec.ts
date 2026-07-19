import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogContext } from '../ports/agent.port';
import { RuleExtractionAgent } from './rule-extraction.agent';

/**
 * multi-agent refactor — `RuleExtractionAgent`, one of the two STRUCTURED
 * role-agents. Turns free-text operator rules into a validated
 * `ConstraintSet`, respecting `DEEPSEEK_ADAPTER` (json vs tooluse) EXACTLY
 * like the pre-refactor `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter`
 * (reused unchanged — see `deepseek-model-scoped-client.ts`), while sending
 * its OWN model/temperature (`DEEPSEEK_MODEL_EXTRACT`/`DEEPSEEK_TEMPERATURE_EXTRACT`).
 */

const catalogContext: CatalogContext = {
  productCodes: ['P-100', 'P-200'],
  families: ['COIL'],
  zones: ['CABIN_SIDE', 'CENTER', 'DOOR_SIDE'],
  destinations: ['dest-1'],
};

function mockClient(overrides: { chatCompletion?: unknown; chatCompletionWithTools?: unknown } = {}) {
  return {
    chatCompletion: vi.fn().mockResolvedValue(overrides.chatCompletion ?? JSON.stringify({ version: 1, hardRules: [] })),
    chatCompletionWithTools: vi.fn().mockResolvedValue(overrides.chatCompletionWithTools ?? JSON.stringify({ version: 1, hardRules: [] })),
  };
}

describe('RuleExtractionAgent — json mode (default)', () => {
  it('extracts a validated ConstraintSet via plain chatCompletion, using its own model/temperature', async () => {
    const golden = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };
    const client = mockClient({ chatCompletion: JSON.stringify(golden) });
    const agent = new RuleExtractionAgent(client, 'json', { model: 'extract-model', temperature: 0.2 });

    const result = await agent.extract('Do not stack P-100.', catalogContext);

    expect(result).toEqual(golden);
    expect(client.chatCompletion).toHaveBeenCalledTimes(1);
    const [params] = client.chatCompletion.mock.calls[0];
    expect(params.model).toBe('extract-model');
    expect(params.temperature).toBe(0.2);
    expect(client.chatCompletionWithTools).not.toHaveBeenCalled();
  });

  it('injects the catalog context into the system prompt (reused DeepSeekJsonAdapter logic)', async () => {
    const client = mockClient();
    const agent = new RuleExtractionAgent(client, 'json', { model: 'extract-model' });

    await agent.extract('Any rule.', catalogContext);

    const [params] = client.chatCompletion.mock.calls[0];
    const systemMessage = params.messages.find((message: { role: string }) => message.role === 'system');
    expect(systemMessage.content).toContain('P-100');
  });
});

describe('RuleExtractionAgent — tooluse mode (opt-in)', () => {
  it('extracts a validated ConstraintSet by forcing the set_constraints tool, using its own model/temperature', async () => {
    const golden = { version: 1, hardRules: [{ type: 'STACKING_PROHIBITION', productCode: 'P-100' }] };
    const client = mockClient({ chatCompletionWithTools: JSON.stringify(golden) });
    const agent = new RuleExtractionAgent(client, 'tooluse', { model: 'extract-model-tooluse', temperature: 0.3 });

    const result = await agent.extract('Do not stack P-100.', catalogContext);

    expect(result).toEqual(golden);
    expect(client.chatCompletionWithTools).toHaveBeenCalledTimes(1);
    const [params] = client.chatCompletionWithTools.mock.calls[0];
    expect(params.model).toBe('extract-model-tooluse');
    expect(params.temperature).toBe(0.3);
    expect(params.toolChoice).toEqual({ type: 'function', function: { name: 'set_constraints' } });
    expect(client.chatCompletion).not.toHaveBeenCalled();
  });
});
