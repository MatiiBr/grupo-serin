# Tasks: Autonomous Plan Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900-1500 (module port) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | By work unit (contract → integration → cleanup) |
| Delivery strategy | chained-pr |
| Chain strategy | dependency-order |

Decision needed before apply: Yes — confirm which agent-branch files port verbatim vs. adapt.
Chained PRs recommended: Yes
Chain strategy: dependency-order
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Port `ConstraintSet` shared contract (hard-rule only) | PR 1 | ✅ Done. Pure types, no engine coupling. |
| 2 | Wire `PlanningAgentService` to `develop`'s `generate()` + `evaluation`; port `applyConstraints` here (couples to input shape) | PR 2 | The integration seam. |
| 3 | Retire single-pass scorer; fold soft-pref concepts into evaluator weights | PR 3 | One scorer only. |

> **Re-scope (evidence-based, Unit 1):** `applyConstraints` was moved OUT of Unit 1 into Unit 2. It sets per-product fields (`allowedZones`, `fragile`, `maxTier`) and input `tiers`/`softPreferences` that `develop`'s `LoadingPlannerInput`/`PlannerProductInput` do NOT have and its solver does NOT honor — porting it in isolation would be dead code. It belongs with the integration seam, where the solver is extended to consume the constraint fields. Also: the `SoftPreference` half of `ConstraintSet` was **retired** (not ported) — soft objectives live as `LoadingPlanEvaluator` penalty weights, per the "one scorer" decision.

## Phase 1: Tests First

- [ ] 1.1 (Unit 2) Port `ConstraintSet` structural + anti-hallucination gate tests; confirm they pass unmodified against the shared contract on `develop`.
- [ ] 1.2 (Unit 2) Add a test that `PlanningAgentService.plan()` calls `HeuristicLoadingPlanner.generate()` and surfaces the returned `evaluation.score` in its preview.
- [ ] 1.3 (Unit 2) Add a test that a `ConstraintSet` translated via `applyConstraints` produces the expected input flags consumed by `develop`'s planner.
- [ ] 1.4 (Unit 2) Characterization test: the same operation + empty constraints yields the same winning candidate the bare `develop` planner would pick (agent layer is transparent when it adds nothing).

## Phase 2: Implementation

- [x] 2.1 (Unit 1) Bring `packages/shared` `ConstraintSet` types onto `develop`; reconcile with existing shared enums. **Done:** `packages/shared/src/constraint-set.ts` (hard-rule contract only; `SoftPreference` retired), exported from `index.ts`. Compiles against `develop`'s 6-family `ProductFamily` + `TruckZoneType`. Verified: typecheck (3 workspaces), test:api 95/95, lint clean.
- [ ] 2.2 (Unit 2) Bring `apps/api/src/planning-agent/` module (agents, adapters, ports, config, DTOs) onto `develop`.
- [ ] 2.3 (Unit 2) Port + adapt `applyConstraints` to `develop`'s `LoadingPlannerInput`/`PlannerProductInput` shape; extend the solver to honor the constraint fields it does not yet consume.
- [ ] 2.4 (Unit 2) Change `PlanningAgentService`'s solver call to `HeuristicLoadingPlanner.generate()`; read `evaluation` from the result into the preview/DTO.
- [ ] 2.5 (Unit 3) Delete the agent branch's single-pass `candidate-scoring`/soft-preferences; if valuable, add its concepts as `LoadingPlanEvaluator` penalty weights (single scorer).
- [ ] 2.6 (Unit 2) Register the module in `AppModule`; keep the controller route additive.

## Phase 3: Verification

- [ ] 3.1 Run `npm run test:api` (all green, including ported agent tests).
- [ ] 3.2 Run `npm run typecheck` across workspaces.
- [ ] 3.3 Run `npm run lint`.
- [ ] 3.4 Boot the API against Postgres; confirm the agent route returns a plan whose `evaluation.score` matches a direct `generate()` call for the same constraints.
- [ ] 3.5 Confirm no second scorer remains (grep for the retired soft-preferences scorer).
