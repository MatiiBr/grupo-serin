import type { DeepSeekClient } from '../adapters/deepseek.client';
import type { DeepSeekAdapterKind, DeepSeekAgentsConfig } from '../config/deepseek.config';
import { AgentTeam } from './agent-team';
import { DiagnosisAgent } from './diagnosis.agent';
import { PlanExplanationAgent } from './plan-explanation.agent';
import { RuleExtractionAgent } from './rule-extraction.agent';
import { RulePatchAgent } from './rule-patch.agent';

/**
 * multi-agent refactor — builds a fully-formed `AgentTeam` from a real
 * `DeepSeekClient` plus `deepseekConfig`'s `adapter` (json/tooluse, same
 * `DEEPSEEK_ADAPTER` switch as the pre-refactor `selectAgentPortAdapter`)
 * and per-role `agents` namespace. `PlanningAgentModule` calls this instead
 * of the old `selectAgentPortAdapter` to build its `AGENT_PORT` provider —
 * `selectAgentPortAdapter` itself is untouched and still covered by its own
 * spec (kept for reference/direct-adapter use elsewhere, if ever needed).
 */
export function buildAgentTeam(client: DeepSeekClient, adapterKind: DeepSeekAdapterKind, agentsConfig: DeepSeekAgentsConfig): AgentTeam {
  return new AgentTeam({
    extraction: new RuleExtractionAgent(client, adapterKind, agentsConfig.extract),
    patch: new RulePatchAgent(client, adapterKind, agentsConfig.revise),
    explanation: new PlanExplanationAgent(client, agentsConfig.explain),
    diagnosis: new DiagnosisAgent(client, agentsConfig.diagnose),
  });
}
