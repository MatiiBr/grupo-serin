# Proposal: Planner Constraints Scoring MVP

## Intent

Make the current planner measurable before adding search or AI by introducing explicit constraint evaluation and a numeric score.

## Scope

### In Scope
- Add a reusable loading-plan evaluator for hard/soft constraints.
- Enforce zone max weight as a critical constraint during generated plan evaluation.
- Add score and violation/penalty details to planner results.
- Keep the existing first-fit heuristic and public API behavior.
- Add unit tests for scoring, max zone weight, and non-regression.

### Out of Scope
- Reinforcement learning or model training.
- Multi-candidate search.
- Stacking placement.
- Database schema changes.

## Capabilities

### New Capabilities
- `planner-constraints-scoring`: Constraint and score evaluation for generated loading plans.

### Modified Capabilities
- None

## Approach

Add a pure evaluator beside the planner domain. `HeuristicLoadingPlanner.generate()` will produce its existing placement, then evaluate the result and merge evaluator alerts/metrics into the returned result.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/domain/loading-planner/` | Modified/New | Evaluator, types, tests, planner integration. |
| `apps/api/src/loading-plans/loading-plans.service.ts` | Modified | Persist score fields only if already available in result DTO; no schema change. |
| `openspec/specs/` | New | Planner scoring capability spec. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Score becomes fake precision | Medium | Keep score simple and inspectable via penalties. |
| Scope creep into optimizer | Medium | Do not alter placement search in this change. |
| Breaking generated plan behavior | Low | Preserve existing tests and add evaluator unit tests. |

## Rollback Plan

Revert this change commit to restore the heuristic without score evaluation.

## Dependencies

- Current heuristic planner.
- Existing Vitest API tests.

## Success Criteria

- [x] Planner result includes score/evaluation details in domain types.
- [x] Zone max weight violations produce critical alerts.
- [x] Existing planner placement behavior remains intact.
- [x] API tests and typecheck pass.
