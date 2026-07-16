import { describe, expect, it, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { DeepSeekRateLimitError, DeepSeekRequestError, DeepSeekTimeoutError } from './adapters/deepseek.client';
import { DeepSeekExceptionFilter } from './deepseek-exception.filter';

/**
 * loading-agent-llm resilience protocol — maps typed `DeepSeekError`
 * subclasses to meaningful HTTP responses on `PlanningAgentController`,
 * instead of a generic 500: 429 (+ Retry-After) for rate limiting, 504 for
 * timeout, 503 for upstream 5xx/exhausted retries, 502 for a non-retryable
 * upstream 4xx (still not the generic 500 the framework default would emit).
 */

function buildHost() {
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status, setHeader };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json, setHeader };
}

describe('DeepSeekExceptionFilter', () => {
  it('maps DeepSeekRateLimitError to HTTP 429 with a Retry-After header (seconds, rounded up)', () => {
    const { host, status, json, setHeader } = buildHost();
    const filter = new DeepSeekExceptionFilter();

    filter.catch(new DeepSeekRateLimitError('rate limited', 4500), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '5');
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429, message: expect.any(String) }));
  });

  it('maps DeepSeekRateLimitError without a retryAfterMs to HTTP 429 without setting the header', () => {
    const { host, status, setHeader } = buildHost();
    const filter = new DeepSeekExceptionFilter();

    filter.catch(new DeepSeekRateLimitError('rate limited'), host);

    expect(status).toHaveBeenCalledWith(429);
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('maps DeepSeekTimeoutError to HTTP 504', () => {
    const { host, status, json } = buildHost();
    const filter = new DeepSeekExceptionFilter();

    filter.catch(new DeepSeekTimeoutError('timed out'), host);

    expect(status).toHaveBeenCalledWith(504);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 504 }));
  });

  it('maps an exhausted-retries 5xx DeepSeekRequestError to HTTP 503, not the generic 500', () => {
    const { host, status, json } = buildHost();
    const filter = new DeepSeekExceptionFilter();

    filter.catch(new DeepSeekRequestError('failed', undefined, 500), host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 503 }));
  });

  it('maps a network-level DeepSeekRequestError (no status) to HTTP 503', () => {
    const { host, status } = buildHost();
    const filter = new DeepSeekExceptionFilter();

    filter.catch(new DeepSeekRequestError('network error', undefined, undefined), host);

    expect(status).toHaveBeenCalledWith(503);
  });

  it('maps a non-retryable upstream 4xx DeepSeekRequestError to HTTP 502, not the generic 500', () => {
    const { host, status, json } = buildHost();
    const filter = new DeepSeekExceptionFilter();

    filter.catch(new DeepSeekRequestError('failed', undefined, 401), host);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 502 }));
  });
});
