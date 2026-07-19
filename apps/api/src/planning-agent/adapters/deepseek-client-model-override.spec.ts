import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekClient } from './deepseek.client';

/**
 * multi-agent refactor — `DeepSeekClient.chatCompletion`/
 * `chatCompletionWithTools` gain an OPTIONAL per-call `model`/`temperature`
 * override, consumed by the `agents/` role-agents (each role scopes the
 * client to its own model/temperature — see `agents/deepseek-model-scoped-client.ts`).
 * Existing behavior (`deepseek.client.spec.ts`, untouched) MUST stay
 * byte-identical when no override is passed: no `temperature` field is added
 * to the request body at all unless a temperature is actually resolved.
 */

const config = { baseUrl: 'https://example.com/v1', apiKey: 'secret-key', model: 'deepseek-chat', maxRetries: 0 };

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('DeepSeekClient — per-call model/temperature override (multi-agent refactor)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('chatCompletion uses the client base model and omits temperature when neither is overridden', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

    const client = new DeepSeekClient(config);
    await client.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-chat');
    expect(body).not.toHaveProperty('temperature');
  });

  it('chatCompletion uses a per-call model override instead of the base model', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

    const client = new DeepSeekClient(config);
    await client.chatCompletion({ messages: [{ role: 'user', content: 'hi' }], model: 'deepseek-explain-model' });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-explain-model');
  });

  it('chatCompletion includes a per-call temperature override in the request body', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

    const client = new DeepSeekClient(config);
    await client.chatCompletion({ messages: [{ role: 'user', content: 'hi' }], temperature: 0.9 });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.temperature).toBe(0.9);
  });

  it('chatCompletion falls back to the client-configured base temperature when no per-call override is passed', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

    const client = new DeepSeekClient({ ...config, temperature: 0.3 });
    await client.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.temperature).toBe(0.3);
  });

  it('chatCompletionWithTools uses the client base model and omits temperature when neither is overridden', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'set_constraints', arguments: '{}' } }] } }],
      }),
    );

    const client = new DeepSeekClient(config);
    await client.chatCompletionWithTools({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'set_constraints', description: 'd', parameters: {} } }],
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-chat');
    expect(body).not.toHaveProperty('temperature');
  });

  it('chatCompletionWithTools uses a per-call model/temperature override', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'set_constraints', arguments: '{}' } }] } }],
      }),
    );

    const client = new DeepSeekClient(config);
    await client.chatCompletionWithTools({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'set_constraints', description: 'd', parameters: {} } }],
      model: 'deepseek-extract-model',
      temperature: 0.1,
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-extract-model');
    expect(body.temperature).toBe(0.1);
  });
});
