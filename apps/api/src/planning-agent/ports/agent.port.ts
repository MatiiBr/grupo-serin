import type { ConstraintSet } from '@camiones/shared';
import type { LoadingPlannerResult } from '../../domain/loading-planner/loading-planner.types';

/**
 * loading-agent-llm Phase 6.1 — the port the `planning-agent` module
 * programs against; `DeepSeekJsonAdapter` (default) and
 * `DeepSeekToolUseAdapter` (experimental) are its only implementations.
 * Keeping the port here (not in `adapters/`) lets the future
 * `planning-agent.service` depend on this interface only, per design.md's
 * flow: rulesText -> planConstraints -> gate -> applyConstraints -> generate
 * -> explainPlan -> preview.
 */

/** Real catalog values from the operation being planned, injected into the prompt so the model uses real codes instead of hallucinating. */
export interface CatalogContext {
  productCodes: string[];
  families: string[];
  zones: string[];
  destinations: string[];
}

export interface PlanConstraintsParams {
  rulesText: string;
  catalogContext: CatalogContext;
}

export interface ExplainPlanParams {
  plan: LoadingPlannerResult;
  constraints: ConstraintSet;
}

export interface AgentPort {
  /** Turns free-text operator rules into a structured (not-yet-validated) `ConstraintSet`. */
  planConstraints(params: PlanConstraintsParams): Promise<ConstraintSet>;
  /** Produces a human-readable explanation of a generated plan given the constraints that were applied. */
  explainPlan(params: ExplainPlanParams): Promise<string>;
}

/**
 * loading-agent-llm Phase 8 — DI token for `AgentPort`. Interfaces have no
 * runtime representation, so Nest needs a concrete token to bind the
 * `DeepSeekJsonAdapter` (default) implementation to in `PlanningAgentModule`.
 */
export const AGENT_PORT = Symbol('AGENT_PORT');
