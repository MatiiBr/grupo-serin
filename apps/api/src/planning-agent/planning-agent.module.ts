import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { DeepSeekClient } from './adapters/deepseek.client';
import { deepseekConfig } from './config/deepseek.config';
import { AGENT_PORT } from './ports/agent.port';
import { PlanningAgentController } from './planning-agent.controller';
import { selectAgentPortAdapter } from './planning-agent-port.factory';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm Phase 8.6 + real tool-use adapter — wires the
 * agent-assisted planning PREVIEW feature. `ConfigModule.forFeature(deepseekConfig)`
 * registers the `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`/
 * `DEEPSEEK_ADAPTER` namespace (Phase 5.1); `DeepSeekClient` is built from it
 * by KEY; `AGENT_PORT` binds via `selectAgentPortAdapter` (see
 * `planning-agent-port.factory.ts`) to `DeepSeekJsonAdapter` (DEFAULT,
 * `DEEPSEEK_ADAPTER` unset or `'json'`) or `DeepSeekToolUseAdapter`
 * (opt-in, `DEEPSEEK_ADAPTER=tooluse` — real OpenAI-compatible
 * tool/function-calling, gated on unverified Huawei Cloud DeepSeek
 * tool-calling support). Nothing changes for existing deployments unless
 * `DEEPSEEK_ADAPTER=tooluse` is set explicitly.
 */
@Module({
  imports: [ConfigModule.forFeature(deepseekConfig)],
  controllers: [PlanningAgentController],
  providers: [
    {
      provide: DeepSeekClient,
      // `deepseekConfig`'s shape (baseUrl/apiKey/model + timeoutMs/maxRetries/
      // maxConcurrency/minIntervalMs) matches `DeepSeekClientConfig` directly.
      useFactory: (config: ConfigType<typeof deepseekConfig>) => new DeepSeekClient(config),
      inject: [deepseekConfig.KEY],
    },
    {
      provide: AGENT_PORT,
      useFactory: (client: DeepSeekClient, config: ConfigType<typeof deepseekConfig>) => selectAgentPortAdapter(config.adapter, client),
      inject: [DeepSeekClient, deepseekConfig.KEY],
    },
    PlanningAgentService,
  ],
})
export class PlanningAgentModule {}
