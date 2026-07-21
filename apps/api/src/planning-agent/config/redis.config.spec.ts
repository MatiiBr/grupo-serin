import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRedisConnection, redisConfig } from './redis.config';

/**
 * loading-agent-llm Batch 13 (BullMQ + Redis queue/worker) — `registerAs('redis', ...)`
 * namespace. Reads `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` from `process.env`,
 * defaulting to `127.0.0.1`/`6381` (the docker-compose `redis` service's host
 * port) when unset — no `.env` changes required.
 */

const ENV_KEYS = ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'PLAN_AGENT_INLINE_WORKER'] as const;

describe('redisConfig (loading-agent-llm Batch 13)', () => {
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

  it('defaults host to 127.0.0.1 and port to 6381 when REDIS_HOST/REDIS_PORT are unset', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_URL;

    const config = redisConfig();

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(6381);
    expect(config.url).toBeUndefined();
  });

  it('reads REDIS_HOST and REDIS_PORT from process.env', () => {
    process.env.REDIS_HOST = 'redis.internal';
    process.env.REDIS_PORT = '6400';
    delete process.env.REDIS_URL;

    const config = redisConfig();

    expect(config.host).toBe('redis.internal');
    expect(config.port).toBe(6400);
  });

  it('falls back to default port when REDIS_PORT is set but not a finite number', () => {
    process.env.REDIS_PORT = 'not-a-number';

    const config = redisConfig();

    expect(config.port).toBe(6381);
  });

  it('reads REDIS_URL from process.env', () => {
    process.env.REDIS_URL = 'redis://user:pass@managed-redis:6380';

    const config = redisConfig();

    expect(config.url).toBe('redis://user:pass@managed-redis:6380');
  });

  it('exposes the namespace token as redisConfig.KEY', () => {
    expect(redisConfig.KEY).toBe('CONFIGURATION(redis)');
  });

  describe('inlineWorker (PLAN_AGENT_INLINE_WORKER)', () => {
    it('defaults to true when PLAN_AGENT_INLINE_WORKER is unset (every process runs its own worker)', () => {
      delete process.env.PLAN_AGENT_INLINE_WORKER;

      expect(redisConfig().inlineWorker).toBe(true);
    });

    it('is false when PLAN_AGENT_INLINE_WORKER is "false" (API-only instance, no inline worker)', () => {
      process.env.PLAN_AGENT_INLINE_WORKER = 'false';

      expect(redisConfig().inlineWorker).toBe(false);
    });

    it('is false when PLAN_AGENT_INLINE_WORKER is "0"', () => {
      process.env.PLAN_AGENT_INLINE_WORKER = '0';

      expect(redisConfig().inlineWorker).toBe(false);
    });

    it('is true when PLAN_AGENT_INLINE_WORKER is "true"', () => {
      process.env.PLAN_AGENT_INLINE_WORKER = 'true';

      expect(redisConfig().inlineWorker).toBe(true);
    });

    it('falls back to the default (true) when the value is neither truthy nor falsy', () => {
      process.env.PLAN_AGENT_INLINE_WORKER = 'maybe';

      expect(redisConfig().inlineWorker).toBe(true);
    });
  });

  describe('buildRedisConnection', () => {
    it('prefers url when set, ignoring host/port', () => {
      const connection = buildRedisConnection({ url: 'redis://managed-redis:6380', host: '127.0.0.1', port: 6381 });

      expect(connection).toEqual({ url: 'redis://managed-redis:6380' });
    });

    it('falls back to host/port when url is unset', () => {
      const connection = buildRedisConnection({ url: undefined, host: '127.0.0.1', port: 6381 });

      expect(connection).toEqual({ host: '127.0.0.1', port: 6381 });
    });

    it('falls back to host/port when url is an empty string', () => {
      const connection = buildRedisConnection({ url: '', host: '127.0.0.1', port: 6381 });

      expect(connection).toEqual({ host: '127.0.0.1', port: 6381 });
    });
  });
});
