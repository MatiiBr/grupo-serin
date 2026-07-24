# Exploration: Autonomous Loading Plan

## Current State

The planner has already walked Approaches 1 and 2 from `explore-planner-optimization-domain`:

- **Approach 1 (done)** — `LoadingPlanEvaluator`: a pure, reusable evaluator that scores a plan (base `1000`, penalties for hard violations / unplaced / imbalance / length, reward for placed items) and returns `PlannerEvaluation`.
- **Approach 2 (done)** — multi-candidate search: `HeuristicLoadingPlanner.generate()` builds ~9 deterministic candidate orderings/strategies, evaluates each, and selects the best with a stable lexicographic tie-break, packaging `candidateDiagnostics` with human-readable explanations surfaced in `planner-ui.tsx`.
- **Approach 3 (deferred)** — RL/DRL planner: explicitly parked as "too early for MVP" (needs a stable environment, a reward function, datasets/simulation).

That original exploration also **deferred stacking** ("avoid stacking in the first MVP; keep `stackable` as future scoring input").

In parallel, a separate branch (`feat/stowage-loading-agent`, PR #10, based on the older `main`) built two capabilities the team does NOT have on `develop`:

1. **An LLM agent layer** (`apps/api/src/planning-agent/`): natural-language rules → a validated `ConstraintSet` (structural + anti-hallucination gate) → `applyConstraints` pre-pass → solver, with a self-correcting re-plan loop, five role-specialized agents (rule extraction, rule patch, validation, plan explanation, diagnosis), a durable async job flow (Prisma + BullMQ/Redis worker), and a standalone worker process. The LLM never computes geometry — it only shapes constraints; the deterministic solver still guarantees the plan.
2. **True 3D tier stacking** (vertical pisos) + **per-steel-family 3D rendering** — precisely the stacking the team deferred.

## The Gap → What "Autonomous" Means

Both `develop` (score-first search) and the agent branch (NL rules) still put a **human at the front of the loop**: someone types the rules or picks among candidates. The `develop` engine can *find* a good plan but must be *told* the objectives; the agent can *interpret* objectives but runs on a weaker single-pass solver.

**Autonomous loading plan** = the system takes an operation (orders, destinations, truck) and produces the optimized, validated, explained plan with **minimal human input**: the LLM **infers** the objectives/constraints from context (no hand-written rule text), the `develop` engine searches and scores, and a **closed loop** self-corrects until a target score/validity is met. The human **reviews and approves** — or the system **auto-approves** when the plan clears a confidence threshold.

The key insight: **`develop`'s `LoadingPlanEvaluator` is exactly the reward function that Approach 3 said RL would need.** An LLM-driven loop is the pragmatic middle path between multi-candidate search (done) and full RL (too heavy) — it reuses the deterministic engine as its environment and reward, and keeps reproducibility because the LLM only sets constraints; **the search stays deterministic given those constraints.**

## Affected Areas

- `apps/api/src/domain/loading-planner/` — reuse `LoadingPlanEvaluator` + multi-candidate `generate()` unchanged as the engine; reconcile our 3D tier stacking with `develop`'s axle/layer types.
- `apps/api/src/planning-agent/` — port the LLM agent layer onto `develop`; adapt it to call `develop`'s `generate()` (result now carries `evaluation`).
- `apps/api/src/loading-plans/` — new autonomous entry point that runs inference → search → loop without hand-written rules.
- `packages/shared/` — `ConstraintSet` contract (from the agent branch) + any objective/target types.
- `apps/web/src/features/operations/components/planner-ui.tsx` — surface the LLM explanation alongside `develop`'s candidate diagnostics; port the steel 3D render here (out of `main.tsx`).
- `apps/api/prisma/schema.prisma` — `PlanAgentJob` (additive, from the agent branch) for async autonomous runs.

## Approaches

1. **LLM-driven autonomous loop over the existing engine** — the LLM infers a `ConstraintSet` + objectives from operation context; `develop`'s multi-candidate search + `LoadingPlanEvaluator` optimize; the agent reads the `evaluation` and, if below target or invalid, revises objectives and re-runs; a validation agent + score threshold gate auto-approval.
   - Pros: Reuses the whole `develop` engine as environment + reward; no ML infra; keeps the search deterministic; explainable; the LLM layer already exists to port.
   - Cons: Two lines of work must be reconciled first (types, `main.tsx` → `planner-ui.tsx`, two scoring models unified into one); DeepSeek latency inside a loop (mitigated by the existing async job flow).
   - Effort: Medium.
2. **Full RL/DRL planner** — the original Approach 3.
   - Pros: Long-term ceiling.
   - Cons: Environment/reward/dataset/reproducibility burden; premature.
   - Effort: High.
3. **Heuristic auto-configuration** — deterministic rules-of-thumb infer constraints from operation shape, no LLM.
   - Pros: Fully deterministic, cheap.
   - Cons: No natural-language reasoning; brittle; can't explain or adapt to novel intents.
   - Effort: Low.

## Recommendation

**Approach 1, phased.** It is the honest continuation of the team's own trajectory (a lighter Approach 3), and it reuses `develop`'s evaluator as the reward signal rather than reinventing it.

Discard the agent branch's single-pass `candidate-scoring` (soft-preferences) — it is subsumed by `develop`'s evaluator + candidate strategies; fold its *concepts* (low CoG, lateral balance) into evaluator penalty weights if valuable. Keep the LLM layer and the 3D tier stacking, which are genuinely additive.

### Phased roadmap

| Phase | Goal | First proposal |
|-------|------|----------------|
| **0 · Foundation** | Port the LLM agent layer onto `develop`; make it drive `develop`'s `generate()`; drop our single-pass scorer | `autonomous-plan-foundation` |
| **1 · Autonomous inference** | LLM infers `ConstraintSet` + objectives from operation context (zero hand-written rules) | `autonomous-plan-inference` |
| **2 · Closed optimization loop** | infer → search → evaluate → (if short) diagnose + revise → re-search, until target/budget | `autonomous-plan-loop` |
| **3 · Auto-approval gate** | validation agent + `evaluation.score` threshold decides auto-approve vs. "needs review" | `autonomous-plan-gate` |
| **4 · Explainability + 3D** | LLM explanation + candidate diagnostics unified in `planner-ui.tsx`; port steel 3D + tier stacking | `autonomous-plan-ui` |
| **5 · Async / scale** | reuse the durable job + standalone worker for autonomous runs | `autonomous-plan-async` |

## Risks

- **Reconciliation before value**: Phase 0 must merge two parallel lines (12 colliding files incl. the solver, types, `main.tsx`). Keep it additive where possible; the agent layer sits *above* the engine.
- **Two scoring models**: unify on `LoadingPlanEvaluator`; do not carry two scorers forward.
- **LLM determinism**: constrain the LLM to only emit `ConstraintSet`/objectives; the search remains deterministic, so plans stay reproducible given the same constraints. Log the inferred constraints for auditability.
- **Latency / cost in a loop**: bound loop iterations; run autonomously via the async job flow, not a synchronous request.
- **Over-autonomy**: auto-approval must be gated on a conservative score threshold with a human-review fallback; never auto-approve a plan with hard violations.

## Ready for Proposal

Yes. First proposal: **`autonomous-plan-foundation`** — port the LLM agent layer onto `develop`'s engine and retire the redundant single-pass scorer, so later phases build the autonomous loop on one unified, deterministic optimization core.
