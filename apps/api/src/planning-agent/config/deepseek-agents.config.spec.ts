import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deepseekConfig } from './deepseek.config';

/**
 * multi-agent refactor — per-role `agents.{extract,revise,explain,diagnose}`
 * model/temperature config, added to `deepseekConfig` alongside the existing
 * base `model`/resilience knobs (see `deepseek.config.spec.ts`, untouched).
 * Each role defaults to the base `DEEPSEEK_MODEL`/`DEEPSEEK_TEMPERATURE` when
 * its own `DEEPSEEK_MODEL_*`/`DEEPSEEK_TEMPERATURE_*` env var is unset, so
 * every LLM call is byte-identical to today's when nothing new is configured.
 */

const ENV_KEYS = [
  'DEEPSEEK_MODEL',
  'DEEPSEEK_TEMPERATURE',
  'DEEPSEEK_MODEL_EXTRACT',
  'DEEPSEEK_MODEL_REVISE',
  'DEEPSEEK_MODEL_EXPLAIN',
  'DEEPSEEK_MODEL_DIAGNOSE',
  'DEEPSEEK_TEMPERATURE_EXTRACT',
  'DEEPSEEK_TEMPERATURE_REVISE',
  'DEEPSEEK_TEMPERATURE_EXPLAIN',
  'DEEPSEEK_TEMPERATURE_DIAGNOSE',
] as const;

describe('deepseekConfig — per-agent model/temperature (multi-agent refactor)', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('defaults every role model to the base DEEPSEEK_MODEL when its own DEEPSEEK_MODEL_* is unset', () => {
    process.env.DEEPSEEK_MODEL = 'deepseek-chat';

    const config = deepseekConfig();

    expect(config.agents.extract.model).toBe('deepseek-chat');
    expect(config.agents.revise.model).toBe('deepseek-chat');
    expect(config.agents.explain.model).toBe('deepseek-chat');
    expect(config.agents.diagnose.model).toBe('deepseek-chat');
  });

  it('defaults every role temperature to undefined when neither the base nor the role temperature is set', () => {
    const config = deepseekConfig();

    expect(config.temperature).toBeUndefined();
    expect(config.agents.extract.temperature).toBeUndefined();
    expect(config.agents.revise.temperature).toBeUndefined();
    expect(config.agents.explain.temperature).toBeUndefined();
    expect(config.agents.diagnose.temperature).toBeUndefined();
  });

  it('reads a role-specific model override from DEEPSEEK_MODEL_EXTRACT/_REVISE/_EXPLAIN/_DIAGNOSE independently', () => {
    process.env.DEEPSEEK_MODEL = 'deepseek-chat';
    process.env.DEEPSEEK_MODEL_EXTRACT = 'deepseek-reasoner';
    process.env.DEEPSEEK_MODEL_REVISE = 'deepseek-revise-model';
    process.env.DEEPSEEK_MODEL_EXPLAIN = 'deepseek-explain-model';
    process.env.DEEPSEEK_MODEL_DIAGNOSE = 'deepseek-diagnose-model';

    const config = deepseekConfig();

    expect(config.agents.extract.model).toBe('deepseek-reasoner');
    expect(config.agents.revise.model).toBe('deepseek-revise-model');
    expect(config.agents.explain.model).toBe('deepseek-explain-model');
    expect(config.agents.diagnose.model).toBe('deepseek-diagnose-model');
  });

  it('reads a base DEEPSEEK_TEMPERATURE and cascades it to every role whose own temperature is unset', () => {
    process.env.DEEPSEEK_TEMPERATURE = '0.4';

    const config = deepseekConfig();

    expect(config.temperature).toBe(0.4);
    expect(config.agents.extract.temperature).toBe(0.4);
    expect(config.agents.diagnose.temperature).toBe(0.4);
  });

  it('reads a role-specific temperature override that wins over the base temperature', () => {
    process.env.DEEPSEEK_TEMPERATURE = '0.4';
    process.env.DEEPSEEK_TEMPERATURE_EXPLAIN = '0.9';

    const config = deepseekConfig();

    expect(config.agents.explain.temperature).toBe(0.9);
    expect(config.agents.extract.temperature).toBe(0.4);
  });

  it('falls back to undefined when a temperature env var is set but not a finite number', () => {
    process.env.DEEPSEEK_TEMPERATURE_DIAGNOSE = 'not-a-number';

    const config = deepseekConfig();

    expect(config.agents.diagnose.temperature).toBeUndefined();
  });
});
