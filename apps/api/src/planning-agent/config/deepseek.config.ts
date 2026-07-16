import { registerAs } from '@nestjs/config';

/**
 * loading-agent-llm Phase 5.1 — `registerAs('deepseek', ...)` namespace.
 * Reads `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` from
 * `process.env`. `DeepSeekClient` (Phase 5.3) injects this by KEY via
 * `ConfigType<typeof deepseekConfig>`.
 */
export const deepseekConfig = registerAs('deepseek', () => ({
  baseUrl: process.env.DEEPSEEK_BASE_URL,
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
}));
