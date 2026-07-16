import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { DeepSeekJsonAdapter } from './adapters/deepseek-json.adapter';
import { DeepSeekClient } from './adapters/deepseek.client';
import { deepseekConfig } from './config/deepseek.config';
import { AGENT_PORT } from './ports/agent.port';
import { PlanningAgentController } from './planning-agent.controller';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm Phase 8.6 — wires the agent-assisted planning PREVIEW
 * feature. `ConfigModule.forFeature(deepseekConfig)` registers the
 * `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL` namespace (Phase
 * 5.1); `DeepSeekClient` is built from it by KEY; `AGENT_PORT` binds to
 * `DeepSeekJsonAdapter` — the DEFAULT `AgentPort` implementation (Phase
 * 6.3). Swap the `AGENT_PORT` provider to point at
 * `DeepSeekToolUseAdapter` once Huawei function-calling is verified — no
 * other file needs to change (`PlanningAgentService` only depends on the
 * `AgentPort` interface).
 */
@Module({
  imports: [ConfigModule.forFeature(deepseekConfig)],
  controllers: [PlanningAgentController],
  providers: [
    {
      provide: DeepSeekClient,
      useFactory: (config: ConfigType<typeof deepseekConfig>) => new DeepSeekClient(config),
      inject: [deepseekConfig.KEY],
    },
    {
      provide: AGENT_PORT,
      useFactory: (client: DeepSeekClient) => new DeepSeekJsonAdapter(client),
      inject: [DeepSeekClient],
    },
    PlanningAgentService,
  ],
})
export class PlanningAgentModule {}
