import type { ConstraintSet } from '@camiones/shared';
import type {
  AgentPort,
  DiagnoseUnresolvedPlanParams,
  ExplainPlanParams,
  PlanConstraintsParams,
  ReviseConstraintsParams,
} from '../ports/agent.port';
import type { DiagnosisAgent } from './diagnosis.agent';
import type { PlanExplanationAgent } from './plan-explanation.agent';
import type { RuleExtractionAgent } from './rule-extraction.agent';
import type { RulePatchAgent } from './rule-patch.agent';

/**
 * multi-agent refactor — the four role-agents wired together. `AgentTeam`
 * implements `AgentPort` by delegating each method to the matching
 * role-agent: `planConstraints` -> `extraction.extract`, `reviseConstraints`
 * -> `patch.revise`, `explainPlan` -> `explanation.explain`,
 * `diagnoseUnresolvedPlan` -> `diagnosis.diagnose`. `PlanningAgentModule`
 * binds `AGENT_PORT` to an `AgentTeam` (built by `agent-team.factory.ts`)
 * instead of a single `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter` —
 * `PlanningAgentService` is UNCHANGED, it only ever depended on `AgentPort`.
 *
 * Takes the four role-agent instances directly (not a `DeepSeekClient`) so
 * this class is a pure, easily-testable delegation layer — see
 * `agent-team.factory.ts` for how the role-agents themselves are built from
 * a `DeepSeekClient` + `deepseekConfig`'s per-role `agents` namespace.
 */
export interface AgentTeamMembers {
  extraction: Pick<RuleExtractionAgent, 'extract'>;
  patch: Pick<RulePatchAgent, 'revise'>;
  explanation: Pick<PlanExplanationAgent, 'explain'>;
  diagnosis: Pick<DiagnosisAgent, 'diagnose'>;
}

export class AgentTeam implements AgentPort {
  constructor(private readonly members: AgentTeamMembers) {}

  planConstraints({ rulesText, catalogContext }: PlanConstraintsParams): Promise<ConstraintSet> {
    return this.members.extraction.extract(rulesText, catalogContext);
  }

  reviseConstraints(params: ReviseConstraintsParams): Promise<ConstraintSet> {
    return this.members.patch.revise(params);
  }

  explainPlan(params: ExplainPlanParams): Promise<string> {
    return this.members.explanation.explain(params);
  }

  diagnoseUnresolvedPlan(params: DiagnoseUnresolvedPlanParams): Promise<string> {
    return this.members.diagnosis.diagnose(params);
  }
}
