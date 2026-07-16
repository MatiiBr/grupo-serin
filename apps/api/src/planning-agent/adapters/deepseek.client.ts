import { RequestQueue } from '../request-queue';

/**
 * loading-agent-llm Phase 5.3 — raw-`fetch` client for the DeepSeek
 * OpenAI-compatible `/chat/completions` endpoint (Huawei Cloud). No SDK
 * dependency — a plain `fetch` POST, config-injected. Consumed by
 * `DeepSeekJsonAdapter` (Phase 6) behind `AgentPort`; never imported from
 * `domain/loading-planner/**` (enforced by `no-llm-imports.spec.ts`).
 *
 * Resilience protocol (conservative + env-configurable):
 *   - Timeout: every attempt is wrapped in an `AbortController` bounded by
 *     `timeoutMs` (`DEEPSEEK_TIMEOUT_MS`, default 60000). Abort → typed
 *     `DeepSeekTimeoutError`.
 *   - Retry + backoff: up to `maxRetries` (`DEEPSEEK_MAX_RETRIES`, default
 *     3) retries on retryable failures, exponential backoff
 *     (`computeBackoffDelayMs`, base 1000ms → 1s/2s/4s) with a deterministic
 *     (non-`Math.random`) jitter derived from the attempt index. On 429/503
 *     with a `Retry-After` header, that duration is waited INSTEAD of the
 *     backoff (`parseRetryAfterMs`, handles both seconds and HTTP-date).
 *   - Queue: every `chatCompletion` call acquires a slot from a
 *     `RequestQueue` (`maxConcurrency`/`minIntervalMs`,
 *     `DEEPSEEK_MAX_CONCURRENCY`/`DEEPSEEK_MIN_INTERVAL_MS`) so all DeepSeek
 *     traffic from this process is paced, not just per-call.
 */

export interface DeepSeekClientConfig {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxConcurrency?: number;
  minIntervalMs?: number;
}

export interface DeepSeekChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekChatCompletionParams {
  messages: DeepSeekChatMessage[];
}

interface DeepSeekChatCompletionResponse {
  choices: Array<{ message: { role: string; content: string } }>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_MAX_CONCURRENCY = 1;
const DEFAULT_MIN_INTERVAL_MS = 0;
const BACKOFF_BASE_MS = 1000;

/** HTTP statuses worth retrying: transient upstream/network conditions. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Deterministic exponential backoff with jitter — NO `Math.random` (unavailable
 * in the deterministic-test contract). The jitter fraction cycles by attempt
 * index, so the same `(attempt, baseMs)` pair always yields the same delay —
 * tests can compute the exact expected wait without duplicating internals.
 * attempt=1 → 1000 * 1.1 = 1100ms, attempt=2 → 2000 * 1.3 = 2600ms,
 * attempt=3 → 4000 * 1.2 = 4800ms.
 */
const JITTER_FRACTION_CYCLE = [0.1, 0.3, 0.2, 0.4, 0.05];

export function computeBackoffDelayMs(attempt: number, baseMs: number = BACKOFF_BASE_MS): number {
  const exponentialMs = baseMs * 2 ** (attempt - 1);
  const jitterFraction = JITTER_FRACTION_CYCLE[(attempt - 1) % JITTER_FRACTION_CYCLE.length];
  return Math.round(exponentialMs * (1 + jitterFraction));
}

/**
 * Parses a `Retry-After` header value — either delta-seconds ("120") or an
 * HTTP-date ("Thu, 16 Jul 2026 12:00:05 GMT") — into a millisecond delay.
 * Returns `undefined` when the value is missing or unparseable as either
 * form. `now` is injectable for deterministic date-based tests.
 */
export function parseRetryAfterMs(value: string | null | undefined, now: () => number = Date.now): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - now());
  }

  return undefined;
}

/** Common base for every typed DeepSeek client error — discriminable via `kind`. */
export abstract class DeepSeekError extends Error {
  abstract readonly kind: 'timeout' | 'rate_limit' | 'request';
}

/** Thrown when a single attempt exceeds `timeoutMs` and its fetch is aborted. */
export class DeepSeekTimeoutError extends DeepSeekError {
  readonly kind = 'timeout' as const;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DeepSeekTimeoutError';
  }
}

/** Thrown for HTTP 429 — carries the parsed `Retry-After` delay, if present. */
export class DeepSeekRateLimitError extends DeepSeekError {
  readonly kind = 'rate_limit' as const;

  constructor(
    message: string,
    readonly retryAfterMs?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DeepSeekRateLimitError';
  }
}

/** Typed error for any other failure talking to DeepSeek — non-2xx HTTP status or a network-level fetch rejection. */
export class DeepSeekRequestError extends DeepSeekError {
  readonly kind = 'request' as const;

  constructor(
    message: string,
    readonly cause?: unknown,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'DeepSeekRequestError';
  }
}

function isRetryable(error: DeepSeekError): boolean {
  if (error instanceof DeepSeekTimeoutError) return true;
  if (error instanceof DeepSeekRateLimitError) return true;
  if (error instanceof DeepSeekRequestError) {
    // `status` is undefined for a network-level fetch rejection — treat as retryable.
    return error.status === undefined || RETRYABLE_STATUSES.has(error.status);
  }
  return false;
}

function resolveWaitMs(error: DeepSeekError, attempt: number): number {
  if (error instanceof DeepSeekRateLimitError && error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }
  if (error instanceof DeepSeekRequestError && error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }
  return computeBackoffDelayMs(attempt);
}

function getRetryAfterHeader(response: Response): string | null {
  const headers = (response as { headers?: { get?: (name: string) => string | null } }).headers;
  return headers?.get?.('retry-after') ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeepSeekClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly queue: RequestQueue;

  constructor(private readonly config: DeepSeekClientConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.queue = new RequestQueue({
      maxConcurrency: config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      minIntervalMs: config.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
    });
  }

  async chatCompletion(params: DeepSeekChatCompletionParams): Promise<string> {
    return this.queue.enqueue(() => this.executeWithRetry(params));
  }

  private async executeWithRetry(params: DeepSeekChatCompletionParams): Promise<string> {
    const totalAttempts = this.maxRetries + 1;
    let lastError: DeepSeekError | undefined;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        return await this.executeOnce(params);
      } catch (error) {
        const typedError = error as DeepSeekError;
        lastError = typedError;

        const isLastAttempt = attempt === totalAttempts;
        if (isLastAttempt || !isRetryable(typedError)) {
          throw typedError;
        }

        await sleep(resolveWaitMs(typedError, attempt));
      }
    }

    // Unreachable: the loop always returns or throws. Satisfies the compiler.
    throw lastError ?? new DeepSeekRequestError('DeepSeek request failed: exhausted retries with no captured error.');
  }

  private async executeOnce(params: DeepSeekChatCompletionParams): Promise<string> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ model: this.config.model, messages: params.messages }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new DeepSeekTimeoutError(`DeepSeek request timed out after ${this.timeoutMs}ms.`, error);
      }
      throw new DeepSeekRequestError('DeepSeek request failed: network error.', error);
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      const retryAfterMs = parseRetryAfterMs(getRetryAfterHeader(response));

      if (response.status === 429) {
        throw new DeepSeekRateLimitError('DeepSeek request rate-limited (429).', retryAfterMs, body);
      }

      throw new DeepSeekRequestError(`DeepSeek request failed with status ${response.status}.`, body, response.status, retryAfterMs);
    }

    const payload = (await response.json()) as DeepSeekChatCompletionResponse;
    return payload.choices[0].message.content;
  }
}
