import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { DeepSeekClient } from './adapters/deepseek.client';
import { buildAgentTeam } from './agents/agent-team.factory';
import { deepseekConfig } from './config/deepseek.config';
import { AGENT_PORT } from './ports/agent.port';
import { PlanAgentJobService } from './plan-agent-job.service';
import { PlanningAgentController } from './planning-agent.controller';
import { PlanningAgentService } from './planning-agent.service';

/**
 * loading-agent-llm Phase 8.6 + real tool-use adapter + multi-agent refactor
 * — wires the agent-assisted planning PREVIEW feature.
 * `ConfigModule.forFeature(deepseekConfig)` registers the
 * `DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`/`DEEPSEEK_ADAPTER`/
 * per-role `agents` namespace; `DeepSeekClient` is built from it by KEY.
 *
 * `AGENT_PORT` now binds to an `AgentTeam` (see `agents/agent-team.ts` +
 * `agents/agent-team.factory.ts`) — a formalized 4-role-agent structure
 * (`RuleExtractionAgent`/`RulePatchAgent`/`PlanExplanationAgent`/
 * `DiagnosisAgent`) instead of a single `DeepSeekJsonAdapter`/
 * `DeepSeekToolUseAdapter` instance directly. The json/tooluse selection
 * (`DEEPSEEK_ADAPTER`, gated on unverified Huawei Cloud DeepSeek
 * tool-calling support) is preserved — `buildAgentTeam` forwards
 * `config.adapter` to the two STRUCTURED role-agents
 * (`RuleExtractionAgent`/`RulePatchAgent`), which reuse
 * `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter` UNCHANGED under the hood.
 * `PlanningAgentService` is UNCHANGED — it only ever depended on
 * `AgentPort`, never on a concrete adapter. Nothing changes behaviorally for
 * existing deployments unless `DEEPSEEK_ADAPTER=tooluse` and/or a per-role
 * `DEEPSEEK_MODEL_*`/`DEEPSEEK_TEMPERATURE_*` override is set explicitly.
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
      useFactory: (client: DeepSeekClient, config: ConfigType<typeof deepseekConfig>) => buildAgentTeam(client, config.adapter, config.agents),
      inject: [DeepSeekClient, deepseekConfig.KEY],
    },
    PlanningAgentService,
    // ASYNC job flow — in-memory background runner for the sync `plan()` call,
    // exposed via `POST .../plan-agent/jobs` + `GET .../plan-agent/jobs/:jobId`.
    PlanAgentJobService,
  ],
})
export class PlanningAgentModule {}
