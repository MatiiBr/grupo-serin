import { describe, expect, it, vi } from 'vitest';
import { scopeClientToAgent } from './deepseek-model-scoped-client';

/**
 * multi-agent refactor — `scopeClientToAgent` wraps a `DeepSeekClient` (or
 * any object satisfying its `chatCompletion`/`chatCompletionWithTools` pick)
 * so every call made through the wrapper defaults to ONE role's
 * model/temperature. Lets `RuleExtractionAgent`/`RulePatchAgent` reuse
 * `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter` UNCHANGED (those classes
 * never pass `model`/`temperature` themselves) while still getting their own
 * per-agent model/temperature.
 */

function mockClient() {
  return {
    chatCompletion: vi.fn().mockResolvedValue('text-result'),
    chatCompletionWithTools: vi.fn().mockResolvedValue('{}'),
  };
}

describe('scopeClientToAgent', () => {
  it('injects the role model/temperature into every chatCompletion call', async () => {
    const client = mockClient();
    const scoped = scopeClientToAgent(client, { model: 'role-model', temperature: 0.5 });

    await scoped.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });

    expect(client.chatCompletion).toHaveBeenCalledWith({ model: 'role-model', temperature: 0.5, messages: [{ role: 'user', content: 'hi' }] });
  });

  it('injects the role model/temperature into every chatCompletionWithTools call', async () => {
    const client = mockClient();
    const scoped = scopeClientToAgent(client, { model: 'role-model', temperature: 0.5 });
    const tools = [{ type: 'function' as const, function: { name: 'set_constraints', description: 'd', parameters: {} } }];

    await scoped.chatCompletionWithTools({ messages: [{ role: 'user', content: 'hi' }], tools, toolChoice: 'auto' });

    expect(client.chatCompletionWithTools).toHaveBeenCalledWith({
      model: 'role-model',
      temperature: 0.5,
      messages: [{ role: 'user', content: 'hi' }],
      tools,
      toolChoice: 'auto',
    });
  });

  it('omits temperature when the role has no temperature configured', async () => {
    const client = mockClient();
    const scoped = scopeClientToAgent(client, { model: 'role-model' });

    await scoped.chatCompletion({ messages: [] });

    const [params] = client.chatCompletion.mock.calls[0];
    expect(params.model).toBe('role-model');
    expect(params.temperature).toBeUndefined();
  });

  it('returns the underlying client resolved value unchanged', async () => {
    const client = mockClient();
    const scoped = scopeClientToAgent(client, { model: 'role-model' });

    const result = await scoped.chatCompletion({ messages: [] });

    expect(result).toBe('text-result');
  });
});
