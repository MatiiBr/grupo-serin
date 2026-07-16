import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deepseekConfig } from './deepseek.config';

/**
 * loading-agent-llm Phase 5.1 — `registerAs('deepseek', ...)` namespace.
 * Reads `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` from
 * `process.env`; `DEEPSEEK_MODEL` defaults to `deepseek-chat` when unset.
 */

const ENV_KEYS = ['DEEPSEEK_BASE_URL', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'] as const;

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

    expect(config).toEqual({
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
});
