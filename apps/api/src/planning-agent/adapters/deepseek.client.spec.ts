import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeBackoffDelayMs,
  DeepSeekClient,
  DeepSeekRateLimitError,
  DeepSeekRequestError,
  DeepSeekTimeoutError,
  parseRetryAfterMs,
} from './deepseek.client';

/**
 * loading-agent-llm Phase 5.2/5.3 + resilience protocol — raw-`fetch`
 * OpenAI-compatible `/chat/completions` client with timeout, retry+backoff,
 * and an in-process request queue (see `../request-queue.spec.ts` for the
 * queue's own dedicated coverage). Tested ONLY against a mocked global
 * `fetch` and `vi.useFakeTimers()` — NEVER a live network call, NEVER a
 * real wait.
 */

const config = { baseUrl: 'https://example.com/v1', apiKey: 'secret-key', model: 'deepseek-chat', maxRetries: 0 };

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}) {
  const headers = init.headers ?? {};
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('computeBackoffDelayMs (resilience protocol — pure function)', () => {
  it('returns an exponential delay (base * 2^(attempt-1)) plus a deterministic jitter fraction', () => {
    expect(computeBackoffDelayMs(1, 1000)).toBe(1100);
    expect(computeBackoffDelayMs(2, 1000)).toBe(2600);
    expect(computeBackoffDelayMs(3, 1000)).toBe(4800);
  });

  it('is deterministic — calling it twice with the same inputs returns the same value (no Math.random)', () => {
    expect(computeBackoffDelayMs(2, 1000)).toBe(computeBackoffDelayMs(2, 1000));
  });
});

describe('parseRetryAfterMs (resilience protocol — pure function)', () => {
  it('parses a numeric-seconds Retry-After value into milliseconds', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
  });

  it('parses an HTTP-date Retry-After value into milliseconds from now', () => {
    const now = () => Date.parse('2026-07-16T12:00:00.000Z');
    expect(parseRetryAfterMs('Thu, 16 Jul 2026 12:00:05 GMT', now)).toBe(5000);
  });

  it('returns undefined for a missing or unparseable header', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('not-a-valid-value')).toBeUndefined();
  });
});

describe('DeepSeekClient (loading-agent-llm 5.2/5.3 + resilience protocol)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
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

  it('throws a typed DeepSeekRequestError on a non-2xx, non-retryable response (401), without crashing raw', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValue(jsonResponse({ error: { message: 'invalid api key' } }, { ok: false, status: 401 }));

    const client = new DeepSeekClient(config);

    await expect(client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] })).rejects.toBeInstanceOf(
      DeepSeekRequestError,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws a typed DeepSeekRequestError when the underlying fetch rejects (network failure) and maxRetries is 0', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockRejectedValue(new Error('ECONNRESET'));

    const client = new DeepSeekClient(config);

    await expect(client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] })).rejects.toBeInstanceOf(
      DeepSeekRequestError,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  describe('timeout', () => {
    it('aborts the fetch and throws a typed DeepSeekTimeoutError once DEEPSEEK_TIMEOUT_MS elapses', async () => {
      vi.useFakeTimers();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted.');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        });
      });

      const client = new DeepSeekClient({ ...config, timeoutMs: 5000, maxRetries: 0 });
      const promise = client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] });
      const assertion = expect(promise).rejects.toBeInstanceOf(DeepSeekTimeoutError);

      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
    });

    it('does not time out when the response arrives before DEEPSEEK_TIMEOUT_MS', async () => {
      vi.useFakeTimers();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] })), 100);
        });
      });

      const client = new DeepSeekClient({ ...config, timeoutMs: 5000, maxRetries: 0 });
      const promise = client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] });

      await vi.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBe('ok');
    });
  });

  describe('retry + backoff', () => {
    it('retries a retryable network failure and succeeds on the next attempt, waiting computeBackoffDelayMs(1) first', async () => {
      vi.useFakeTimers();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

      const client = new DeepSeekClient({ ...config, maxRetries: 3 });
      const promise = client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] });

      await vi.advanceTimersByTimeAsync(computeBackoffDelayMs(1));
      await expect(promise).resolves.toBe('ok');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries HTTP 503 up to maxRetries and throws the last typed DeepSeekRequestError after exhausting them', async () => {
      vi.useFakeTimers();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue(jsonResponse({ error: 'unavailable' }, { ok: false, status: 503 }));

      const client = new DeepSeekClient({ ...config, maxRetries: 3 });
      const promise = client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] });
      const assertion = expect(promise).rejects.toBeInstanceOf(DeepSeekRequestError);

      await vi.advanceTimersByTimeAsync(computeBackoffDelayMs(1));
      await vi.advanceTimersByTimeAsync(computeBackoffDelayMs(2));
      await vi.advanceTimersByTimeAsync(computeBackoffDelayMs(3));

      await assertion;
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('does NOT retry a non-retryable 422 status — fails fast on the first attempt', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue(jsonResponse({ error: 'unprocessable' }, { ok: false, status: 422 }));

      const client = new DeepSeekClient({ ...config, maxRetries: 3 });

      await expect(client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] })).rejects.toBeInstanceOf(
        DeepSeekRequestError,
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('waits the Retry-After duration (seconds) instead of exponential backoff on 429, then succeeds', async () => {
      vi.useFakeTimers();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, { ok: false, status: 429, headers: { 'retry-after': '2' } }))
        .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));

      const client = new DeepSeekClient({ ...config, maxRetries: 3 });
      const promise = client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] });

      await vi.advanceTimersByTimeAsync(1999);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
    });

    it('throws a typed DeepSeekRateLimitError carrying retryAfterMs when 429 retries are exhausted', async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValue(jsonResponse({ error: 'rate limited' }, { ok: false, status: 429, headers: { 'retry-after': '3' } }));

      const client = new DeepSeekClient({ ...config, maxRetries: 0 });

      const error = (await client.chatCompletion({ messages: [{ role: 'user', content: 'plan it' }] }).catch((e: unknown) => e)) as InstanceType<
        typeof DeepSeekRateLimitError
      >;

      expect(error).toBeInstanceOf(DeepSeekRateLimitError);
      expect(error.retryAfterMs).toBe(3000);
    });
  });

  describe('queue', () => {
    it('serializes concurrent chatCompletion calls through the request queue (maxConcurrency default = 1)', async () => {
      vi.useFakeTimers();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      const order: string[] = [];
      mockFetch.mockImplementation(() => {
        order.push('start');
        return new Promise((resolve) => {
          setTimeout(() => {
            order.push('end');
            resolve(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }));
          }, 20);
        });
      });

      const client = new DeepSeekClient(config);
      const p1 = client.chatCompletion({ messages: [{ role: 'user', content: '1' }] });
      const p2 = client.chatCompletion({ messages: [{ role: 'user', content: '2' }] });

      await vi.advanceTimersByTimeAsync(20);
      await vi.advanceTimersByTimeAsync(20);
      await Promise.all([p1, p2]);

      expect(order).toEqual(['start', 'end', 'start', 'end']);
    });
  });
});
