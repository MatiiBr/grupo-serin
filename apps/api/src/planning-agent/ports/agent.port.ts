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

/**
 * self-correcting-replan-loop — a concise, structured summary of what went
 * wrong with a generated plan, handed to `AgentPort.reviseConstraints` so the
 * model can propose an adjusted `ConstraintSet` without re-deriving the whole
 * problem from a raw `LoadingPlannerResult`. Warnings are deliberately NOT
 * included here — `PlanningAgentService`'s clean/retry gate only ever builds
 * a `PlanProblems` when there is something a revision could plausibly fix
 * (unplaced units and/or critical alerts).
 */
export interface PlanProblems {
  unplaced: { productCode: string; reason: string }[];
  criticalAlerts: { type: string; message: string }[];
}

export interface ReviseConstraintsParams {
  rulesText: string;
  previousConstraints: ConstraintSet;
  problems: PlanProblems;
  catalogContext: CatalogContext;
}

export interface AgentPort {
  /** Turns free-text operator rules into a structured (not-yet-validated) `ConstraintSet`. */
  planConstraints(params: PlanConstraintsParams): Promise<ConstraintSet>;
  /** Produces a human-readable explanation of a generated plan given the constraints that were applied. */
  explainPlan(params: ExplainPlanParams): Promise<string>;
  /**
   * self-correcting-replan-loop — given the previous `ConstraintSet` and the
   * concrete problems it caused (unplaced units, critical alerts), proposes
   * an ADJUSTED `ConstraintSet` (same schema) that still honors the
   * operator's intent but is expected to yield a more placeable plan.
   */
  reviseConstraints(params: ReviseConstraintsParams): Promise<ConstraintSet>;
}

/**
 * loading-agent-llm Phase 8 — DI token for `AgentPort`. Interfaces have no
 * runtime representation, so Nest needs a concrete token to bind the
 * `DeepSeekJsonAdapter` (default) implementation to in `PlanningAgentModule`.
 */
export const AGENT_PORT = Symbol('AGENT_PORT');
