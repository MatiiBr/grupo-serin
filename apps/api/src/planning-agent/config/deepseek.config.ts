import { registerAs } from '@nestjs/config';

/**
 * loading-agent-llm Phase 5.1 + resilience protocol — `registerAs('deepseek', ...)`
 * namespace. Reads `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` from
 * `process.env`. `DeepSeekClient` (Phase 5.3) injects this by KEY via
 * `ConfigType<typeof deepseekConfig>`. Also reads the timeout/retry/queue
 * resilience knobs consumed by `DeepSeekClient`'s `RequestQueue` + retry loop —
 * each falls back to its documented default when unset or not a finite number.
 */

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const deepseekConfig = registerAs('deepseek', () => ({
  baseUrl: process.env.DEEPSEEK_BASE_URL,
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  timeoutMs: parseIntEnv(process.env.DEEPSEEK_TIMEOUT_MS, 60_000),
  maxRetries: parseIntEnv(process.env.DEEPSEEK_MAX_RETRIES, 3),
  maxConcurrency: parseIntEnv(process.env.DEEPSEEK_MAX_CONCURRENCY, 1),
  minIntervalMs: parseIntEnv(process.env.DEEPSEEK_MIN_INTERVAL_MS, 0),
}));
