# Tasks: Planner Constraints Scoring MVP

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220-360 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add evaluator and integrate with heuristic | PR 1 | Includes tests/spec archive. |

## Phase 1: Tests First

- [x] 1.1 Add evaluator tests for positive score and inspectable penalties.
- [x] 1.2 Add evaluator test for zone max weight critical alert.
- [x] 1.3 Add planner integration test asserting evaluation exists without changing placement.

## Phase 2: Implementation

- [x] 2.1 Add evaluation result types in `loading-planner.types.ts`.
- [x] 2.2 Create `loading-plan-evaluator.ts` with hard violations and soft penalties.
- [x] 2.3 Integrate evaluator in `heuristic-loading-planner.ts`.

## Phase 3: Verification

- [x] 3.1 Run focused loading-planner tests.
- [x] 3.2 Run `npm run typecheck --workspace @camiones/api`.
- [x] 3.3 Run `npm run test:api`.
