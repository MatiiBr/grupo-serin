import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekClient, DeepSeekRequestError } from './deepseek.client';

/**
 * loading-agent-llm Phase 5.2/5.3 — raw-`fetch` OpenAI-compatible
 * `/chat/completions` client. Tested ONLY against a mocked global `fetch` —
 * NEVER a live network call. Config is injected directly (constructor
 * arg), mirroring the `ConfigType<typeof deepseekConfig>` shape the module
 * (Phase 8) will provide via `ConfigService.get('deepseek')`.
 */

const config = { baseUrl: 'https://example.com/v1', apiKey: 'secret-key', model: 'deepseek-chat' };

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('DeepSeekClient (loading-agent-llm 5.2/5.3)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to {baseUrl}/chat/completions with the model, messages, and Authorization header, and returns the parsed content', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(
      jsonResponse({ choices: [{ message: { role: 'assistant', content: '{"version":1,"hardRules":[]}' } }] }),
    );

    const client = new DeepSeekClient(config);
    const result = await client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret-key', 'Content-Type': 'application/json' });

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'plan it' }] });

    expect(result).toBe('{"version":1,"hardRules":[]}');
  });

  it('throws a typed DeepSeekRequestError on a non-2xx response, without crashing raw', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse({ error: { message: 'invalid api key' } }, { ok: false, status: 401 }));

    const client = new DeepSeekClient(config);

    await expect(client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] })).rejects.toBeInstanceOf(
      DeepSeekRequestError,
    );
  });

  it('throws a typed DeepSeekRequestError when the underlying fetch rejects (network failure)', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockRejectedValue(new Error('ECONNRESET'));

    const client = new DeepSeekClient(config);

    await expect(client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] })).rejects.toBeInstanceOf(
      DeepSeekRequestError,
    );
  });
});
