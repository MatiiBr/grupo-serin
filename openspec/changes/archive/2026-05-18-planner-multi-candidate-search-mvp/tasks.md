# Tasks: Planner Multi-Candidate Search MVP

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180-340 |
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
| 1 | Add deterministic multi-candidate planner search | PR 1 | Includes tests and spec archive. |

## Phase 1: Tests First

- [x] 1.1 Add test where an alternate candidate wins by score.
- [x] 1.2 Keep existing planner tests as compatibility coverage.

## Phase 2: Implementation

- [x] 2.1 Extract current placement into a candidate evaluation helper.
- [x] 2.2 Add deterministic candidate orderings.
- [x] 2.3 Add best-candidate selection with stable tie-breakers.

## Phase 3: Verification

- [x] 3.1 Run focused planner tests.
- [x] 3.2 Run `npm run typecheck --workspace @camiones/api`.
- [x] 3.3 Run `npm run test:api`.
