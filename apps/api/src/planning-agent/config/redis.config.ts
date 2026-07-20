import { registerAs } from '@nestjs/config';

/**
 * loading-agent-llm Batch 13 (BullMQ + Redis queue/worker) — `registerAs('redis', ...)`
 * namespace mirroring `deepseekConfig`'s pattern. Resolves the connection
 * `PlanAgentQueue`/`PlanAgentWorker` hand to BullMQ's `Queue`/`Worker` for the
 * `plan-agent` queue that now owns executing `PlanningAgentService.plan()` in
 * the background (replacing Batch 12's in-process `.then(...)` chain).
 *
 * `REDIS_URL` wins when set (e.g. `redis://user:pass@host:port` for a managed
 * Redis instance); otherwise falls back to `REDIS_HOST`/`REDIS_PORT`,
 * defaulting to `127.0.0.1`/`6381` — the host port the docker-compose `redis`
 * service (`camiones-redis`) already publishes. This means ZERO `.env`
 * changes are required for local dev or the existing test suite: the
 * defaults point straight at the already-running container.
 */

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: parseIntEnv(process.env.REDIS_PORT, 6381),
}));

export type RedisConfig = ReturnType<typeof redisConfig>;

/** BullMQ `ConnectionOptions`-compatible shape: prefers `url` when set, else `host`/`port`. */
export type RedisConnectionOptions = { url: string } | { host: string; port: number };

/** Builds the BullMQ connection object from resolved config — pure/no side effects, does not open a connection itself. */
export function buildRedisConnection(config: Pick<RedisConfig, 'url' | 'host' | 'port'>): RedisConnectionOptions {
  return config.url && config.url !== '' ? { url: config.url } : { host: config.host, port: config.port };
}
