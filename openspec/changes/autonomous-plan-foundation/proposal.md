# Proposal: Autonomous Plan Foundation

## Problem

The LLM agent layer needed for an autonomous loading plan lives on a separate branch (`feat/stowage-loading-agent`) that was built on the older `main` and drives its own single-pass solver. `develop` meanwhile has the superior optimization engine — `LoadingPlanEvaluator` + multi-candidate search. Before any autonomous behavior can be built, the agent layer must sit on `develop` and drive **its** engine, and the two redundant scoring systems must collapse into one.

## Proposed Change

Port the LLM agent layer onto `develop` as an additive module and wire it to the existing engine — no autonomous inference yet, just a unified, deterministic core the later phases build on:

- Bring `packages/shared` `ConstraintSet` contract and `apps/api/src/planning-agent/` (NL rules → validated `ConstraintSet` → `applyConstraints` pre-pass → solver, with the self-correcting loop and role agents) onto `develop`.
- Adapt `PlanningAgentService` to call `develop`'s `HeuristicLoadingPlanner.generate()` and read the returned `evaluation` (score) — replacing the agent branch's single-pass solver call.
- **Retire** the agent branch's single-pass `candidate-scoring` / soft-preferences scorer. `LoadingPlanEvaluator` is the one scorer. Where valuable, fold soft-preference *concepts* (low center of gravity, lateral balance) into evaluator penalty weights — but not as a second system.
- Keep the LLM contract (gate, re-plan loop, agents, DTOs) behavior-preserving; only its solver integration point changes.

## Scope

Affected modules/packages:

- `@camiones/api` — new `planning-agent` module; `loading-plans` integration point.
- `@camiones/shared` — `ConstraintSet` contract.
- OpenSpec planner specifications.

Out of scope (later phases):

- Autonomous constraint/objective inference (`autonomous-plan-inference`).
- The closed optimization loop and auto-approval gate.
- UI changes and the steel 3D / tier-stacking port.
- Async job flow / standalone worker port.
- Reinforcement learning.

## Rollback Plan

The `planning-agent` module and its controller route are purely additive — reverting removes the module and its route with no impact on the existing planner flow. The only schema addition (`PlanAgentJob`) is additive and unused until the async phase, so it can stay or be dropped via a down migration. No changes to `LoadingPlanEvaluator` or the multi-candidate search are required, so the `develop` engine is untouched on rollback.
