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
| 1 | Port `ConstraintSet` shared contract + `applyConstraints` pre-pass | PR 1 | Pure, no engine coupling. |
| 2 | Wire `PlanningAgentService` to `develop`'s `generate()` + `evaluation` | PR 2 | The integration seam. |
| 3 | Retire single-pass scorer; fold soft-pref concepts into evaluator weights | PR 3 | One scorer only. |

## Phase 1: Tests First

- [ ] 1.1 Port `ConstraintSet` structural + anti-hallucination gate tests; confirm they pass unmodified against the shared contract on `develop`.
- [ ] 1.2 Add a test that `PlanningAgentService.plan()` calls `HeuristicLoadingPlanner.generate()` and surfaces the returned `evaluation.score` in its preview.
- [ ] 1.3 Add a test that a `ConstraintSet` translated via `applyConstraints` produces the expected input flags consumed by `develop`'s planner.
- [ ] 1.4 Characterization test: the same operation + empty constraints yields the same winning candidate the bare `develop` planner would pick (agent layer is transparent when it adds nothing).

## Phase 2: Implementation

- [ ] 2.1 Bring `packages/shared` `ConstraintSet` types onto `develop`; reconcile with existing shared enums (`ProductFamily`, alert/zone types).
- [ ] 2.2 Bring `apps/api/src/planning-agent/` module (agents, adapters, ports, config, DTOs) onto `develop`.
- [ ] 2.3 Adapt `applyConstraints` to `develop`'s `LoadingPlannerInput` shape (zone `maxWeightKg`, candidate strategies).
- [ ] 2.4 Change `PlanningAgentService`'s solver call to `HeuristicLoadingPlanner.generate()`; read `evaluation` from the result into the preview/DTO.
- [ ] 2.5 Delete the agent branch's single-pass `candidate-scoring`/soft-preferences; if valuable, add its concepts as `LoadingPlanEvaluator` penalty weights (single scorer).
- [ ] 2.6 Register the module in `AppModule`; keep the controller route additive.

## Phase 3: Verification

- [ ] 3.1 Run `npm run test:api` (all green, including ported agent tests).
- [ ] 3.2 Run `npm run typecheck` across workspaces.
- [ ] 3.3 Run `npm run lint`.
- [ ] 3.4 Boot the API against Postgres; confirm the agent route returns a plan whose `evaluation.score` matches a direct `generate()` call for the same constraints.
- [ ] 3.5 Confirm no second scorer remains (grep for the retired soft-preferences scorer).
