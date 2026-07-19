import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deepseekConfig } from './deepseek.config';

/**
 * loading-agent-llm Phase 5.1 + resilience protocol — `registerAs('deepseek', ...)`
 * namespace. Reads `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` from
 * `process.env`; `DEEPSEEK_MODEL` defaults to `deepseek-chat` when unset.
 * Also reads `DEEPSEEK_TIMEOUT_MS`/`DEEPSEEK_MAX_RETRIES`/
 * `DEEPSEEK_MAX_CONCURRENCY`/`DEEPSEEK_MIN_INTERVAL_MS` for `DeepSeekClient`'s
 * timeout/retry/queue resilience knobs, each defaulting when unset or unparseable.
 */

const ENV_KEYS = [
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_MODEL',
  'DEEPSEEK_TIMEOUT_MS',
  'DEEPSEEK_MAX_RETRIES',
  'DEEPSEEK_MAX_CONCURRENCY',
  'DEEPSEEK_MIN_INTERVAL_MS',
  'DEEPSEEK_MAX_PLAN_ATTEMPTS',
] as const;

describe('deepseekConfig (loading-agent-llm 5.1)', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('reads baseUrl, apiKey, and model from process.env', () => {
    process.env.DEEPSEEK_BASE_URL = 'https://example.com/v1';
    process.env.DEEPSEEK_API_KEY = 'secret-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-reasoner';

    const config = deepseekConfig();

    expect(config).toMatchObject({
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret-key',
      model: 'deepseek-reasoner',
    });
  });

  it('defaults model to "deepseek-chat" when DEEPSEEK_MODEL is unset', () => {
    delete process.env.DEEPSEEK_MODEL;
    process.env.DEEPSEEK_BASE_URL = 'https://example.com/v1';
    process.env.DEEPSEEK_API_KEY = 'secret-key';

    const config = deepseekConfig();

    expect(config.model).toBe('deepseek-chat');
  });

  it('exposes the namespace token as deepseekConfig.KEY', () => {
    expect(deepseekConfig.KEY).toBe('CONFIGURATION(deepseek)');
  });

  it('reads timeoutMs, maxRetries, maxConcurrency, and minIntervalMs from process.env', () => {
    process.env.DEEPSEEK_TIMEOUT_MS = '30000';
    process.env.DEEPSEEK_MAX_RETRIES = '5';
    process.env.DEEPSEEK_MAX_CONCURRENCY = '2';
    process.env.DEEPSEEK_MIN_INTERVAL_MS = '250';

    const config = deepseekConfig();

    expect(config.timeoutMs).toBe(30000);
    expect(config.maxRetries).toBe(5);
    expect(config.maxConcurrency).toBe(2);
    expect(config.minIntervalMs).toBe(250);
  });

  it('defaults timeoutMs=60000, maxRetries=3, maxConcurrency=1, minIntervalMs=0 when unset', () => {
    delete process.env.DEEPSEEK_TIMEOUT_MS;
    delete process.env.DEEPSEEK_MAX_RETRIES;
    delete process.env.DEEPSEEK_MAX_CONCURRENCY;
    delete process.env.DEEPSEEK_MIN_INTERVAL_MS;

    const config = deepseekConfig();

    expect(config.timeoutMs).toBe(60000);
    expect(config.maxRetries).toBe(3);
    expect(config.maxConcurrency).toBe(1);
    expect(config.minIntervalMs).toBe(0);
  });

  it('falls back to defaults when a resilience env var is set but not a finite number', () => {
    process.env.DEEPSEEK_TIMEOUT_MS = 'not-a-number';

    const config = deepseekConfig();

    expect(config.timeoutMs).toBe(60000);
  });

  it('self-correcting-replan-loop — reads maxPlanAttempts from DEEPSEEK_MAX_PLAN_ATTEMPTS', () => {
    process.env.DEEPSEEK_MAX_PLAN_ATTEMPTS = '5';

    const config = deepseekConfig();

    expect(config.maxPlanAttempts).toBe(5);
  });

  it('self-correcting-replan-loop — defaults maxPlanAttempts to 3 when unset', () => {
    delete process.env.DEEPSEEK_MAX_PLAN_ATTEMPTS;

    const config = deepseekConfig();

    expect(config.maxPlanAttempts).toBe(3);
  });

  it('self-correcting-replan-loop — clamps maxPlanAttempts to a minimum of 1', () => {
    process.env.DEEPSEEK_MAX_PLAN_ATTEMPTS = '0';

    const config = deepseekConfig();

    expect(config.maxPlanAttempts).toBe(1);
  });

  it('self-correcting-replan-loop — clamps a negative maxPlanAttempts to 1', () => {
    process.env.DEEPSEEK_MAX_PLAN_ATTEMPTS = '-2';

    const config = deepseekConfig();

    expect(config.maxPlanAttempts).toBe(1);
  });

  it('self-correcting-replan-loop — falls back to default 3 when maxPlanAttempts is not a finite number', () => {
    process.env.DEEPSEEK_MAX_PLAN_ATTEMPTS = 'not-a-number';

    const config = deepseekConfig();

    expect(config.maxPlanAttempts).toBe(3);
  });
});
