import { registerAs } from '@nestjs/config';

/**
 * loading-agent-llm Phase 5.1 + resilience protocol + self-correcting-replan-loop
 * + real tool-use adapter — `registerAs('deepseek', ...)` namespace. Reads
 * `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` from `process.env`.
 * `DeepSeekClient` (Phase 5.3) injects this by KEY via
 * `ConfigType<typeof deepseekConfig>`. Also reads the timeout/retry/queue
 * resilience knobs consumed by `DeepSeekClient`'s `RequestQueue` + retry loop —
 * each falls back to its documented default when unset or not a finite number.
 * `maxPlanAttempts` bounds `PlanningAgentService`'s self-correcting re-plan
 * loop (1 initial `planConstraints` attempt + up to `maxPlanAttempts - 1`
 * `reviseConstraints` retries); a value below 1 is clamped to 1 (never fewer
 * than the initial attempt). `adapter` selects which `AgentPort`
 * implementation `PlanningAgentModule` binds — `'json'` (default,
 * `DeepSeekJsonAdapter`) is the SAFE path; `'tooluse'`
 * (`DeepSeekToolUseAdapter`, real OpenAI-compatible function-calling) is
 * OPT-IN because Huawei Cloud's DeepSeek tool-calling support is UNVERIFIED
 * — any unrecognized value falls back to `'json'` rather than failing to
 * boot.
 *
 * multi-agent refactor — `agents.{extract,revise,explain,diagnose}` carries
 * PER-ROLE model/temperature overrides for the four `agents/` role-agents
 * (`RuleExtractionAgent`/`RulePatchAgent`/`PlanExplanationAgent`/
 * `DiagnosisAgent`, wired together by `AgentTeam`). Each role's `model`
 * defaults to the base `DEEPSEEK_MODEL` and its `temperature` defaults to the
 * base `DEEPSEEK_TEMPERATURE` (itself optional and undefined unless set) when
 * its own `DEEPSEEK_MODEL_*`/`DEEPSEEK_TEMPERATURE_*` env var is unset — so
 * every LLM call is BYTE-IDENTICAL to today's when nothing new is
 * configured (see `DeepSeekClient.chatCompletion`/`chatCompletionWithTools`,
 * which only add a `model`/`temperature` override on top of their existing
 * base-config behavior).
 */

export type DeepSeekAdapterKind = 'json' | 'tooluse';

/** Per-role model/temperature override — see the `agents` namespace above. */
export interface DeepSeekAgentRoleConfig {
  model: string;
  temperature?: number;
}

export interface DeepSeekAgentsConfig {
  extract: DeepSeekAgentRoleConfig;
  revise: DeepSeekAgentRoleConfig;
  explain: DeepSeekAgentRoleConfig;
  diagnose: DeepSeekAgentRoleConfig;
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatEnv(value: string | undefined, fallback: number | undefined): number | undefined {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMaxPlanAttempts(value: string | undefined): number {
  const parsed = parseIntEnv(value, 3);
  return Math.max(1, parsed);
}

function parseAdapterKind(value: string | undefined): DeepSeekAdapterKind {
  return value === 'tooluse' ? 'tooluse' : 'json';
}

/** Resolves one role's model/temperature, falling back to the base values when its own env vars are unset. */
function resolveRoleConfig(baseModel: string, baseTemperature: number | undefined, modelEnvValue: string | undefined, temperatureEnvValue: string | undefined): DeepSeekAgentRoleConfig {
  return {
    model: modelEnvValue && modelEnvValue !== '' ? modelEnvValue : baseModel,
    temperature: parseFloatEnv(temperatureEnvValue, baseTemperature),
  };
}

export const deepseekConfig = registerAs('deepseek', () => {
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
  const temperature = parseFloatEnv(process.env.DEEPSEEK_TEMPERATURE, undefined);

  const agents: DeepSeekAgentsConfig = {
    extract: resolveRoleConfig(model, temperature, process.env.DEEPSEEK_MODEL_EXTRACT, process.env.DEEPSEEK_TEMPERATURE_EXTRACT),
    revise: resolveRoleConfig(model, temperature, process.env.DEEPSEEK_MODEL_REVISE, process.env.DEEPSEEK_TEMPERATURE_REVISE),
    explain: resolveRoleConfig(model, temperature, process.env.DEEPSEEK_MODEL_EXPLAIN, process.env.DEEPSEEK_TEMPERATURE_EXPLAIN),
    diagnose: resolveRoleConfig(model, temperature, process.env.DEEPSEEK_MODEL_DIAGNOSE, process.env.DEEPSEEK_TEMPERATURE_DIAGNOSE),
  };

  return {
    baseUrl: process.env.DEEPSEEK_BASE_URL,
    apiKey: process.env.DEEPSEEK_API_KEY,
    model,
    temperature,
    timeoutMs: parseIntEnv(process.env.DEEPSEEK_TIMEOUT_MS, 60_000),
    maxRetries: parseIntEnv(process.env.DEEPSEEK_MAX_RETRIES, 3),
    maxConcurrency: parseIntEnv(process.env.DEEPSEEK_MAX_CONCURRENCY, 1),
    minIntervalMs: parseIntEnv(process.env.DEEPSEEK_MIN_INTERVAL_MS, 0),
    maxPlanAttempts: parseMaxPlanAttempts(process.env.DEEPSEEK_MAX_PLAN_ATTEMPTS),
    adapter: parseAdapterKind(process.env.DEEPSEEK_ADAPTER),
    agents,
  };
});
