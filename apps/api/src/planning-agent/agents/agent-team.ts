import type { ConstraintSet } from '@camiones/shared';
import type {
  AgentPort,
  DiagnoseUnresolvedPlanParams,
  ExplainPlanParams,
  IntentValidation,
  PlanConstraintsParams,
  ReviseConstraintsParams,
  ValidateIntentParams,
} from '../ports/agent.port';
import type { DiagnosisAgent } from './diagnosis.agent';
import type { PlanExplanationAgent } from './plan-explanation.agent';
import type { RuleExtractionAgent } from './rule-extraction.agent';
import type { RulePatchAgent } from './rule-patch.agent';
import type { ValidationAgent } from './validation.agent';

/**
 * multi-agent refactor + VALIDATION agent — the five role-agents wired
 * together. `AgentTeam` implements `AgentPort` by delegating each method to
 * the matching role-agent: `planConstraints` -> `extraction.extract`,
 * `reviseConstraints` -> `patch.revise`, `explainPlan` ->
 * `explanation.explain`, `diagnoseUnresolvedPlan` -> `diagnosis.diagnose`,
 * `validateIntent` -> `validation.validate` (ADVISORY ONLY — see
 * `ports/agent.port.ts`'s docstring). `PlanningAgentModule` binds
 * `AGENT_PORT` to an `AgentTeam` (built by `agent-team.factory.ts`) instead
 * of a single `DeepSeekJsonAdapter`/`DeepSeekToolUseAdapter` —
 * `PlanningAgentService` is UNCHANGED beyond calling the new
 * `validateIntent` method, it only ever depended on `AgentPort`.
 *
 * Takes the five role-agent instances directly (not a `DeepSeekClient`) so
 * this class is a pure, easily-testable delegation layer — see
 * `agent-team.factory.ts` for how the role-agents themselves are built from
 * a `DeepSeekClient` + `deepseekConfig`'s per-role `agents` namespace.
 */
export interface AgentTeamMembers {
  extraction: Pick<RuleExtractionAgent, 'extract'>;
  patch: Pick<RulePatchAgent, 'revise'>;
  explanation: Pick<PlanExplanationAgent, 'explain'>;
  diagnosis: Pick<DiagnosisAgent, 'diagnose'>;
  /** VALIDATION agent — ADVISORY ONLY intent-match check. */
  validation: Pick<ValidationAgent, 'validate'>;
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

  /** VALIDATION agent — ADVISORY ONLY; never used to alter constraints/plan. */
  validateIntent(params: ValidateIntentParams): Promise<IntentValidation> {
    return this.members.validation.validate(params);
  }
}
