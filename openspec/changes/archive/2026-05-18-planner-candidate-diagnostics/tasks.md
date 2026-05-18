# Tasks: Planner Candidate Diagnostics

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180-320 |
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
| 1 | Add candidate diagnostics to planner/API contract | PR 1 | Includes tests, types, and spec archive. |

## Phase 1: Tests First

- [x] 1.1 Add planner test for winning candidate diagnostics.
- [x] 1.2 Add planner test for candidate summary/tie-break visibility.
- [x] 1.3 Add DTO/API mapping test for optional diagnostics if mapping is covered.

## Phase 2: Domain Implementation

- [x] 2.1 Add planner candidate diagnostic types.
- [x] 2.2 Name deterministic candidates.
- [x] 2.3 Attach compact diagnostics to selected planner result.

## Phase 3: API/Web Contract

- [x] 3.1 Pass optional diagnostics through API responses for generated plans.
- [x] 3.2 Add optional diagnostics to web API types.
- [x] 3.3 Preserve behavior when diagnostics are absent.

## Phase 4: Verification

- [x] 4.1 Run focused planner/API tests.
- [x] 4.2 Run `npm run typecheck --workspace @camiones/api`.
- [x] 4.3 Run `npm run typecheck --workspace @camiones/web`.
- [x] 4.4 Run `npm run test:api`.
