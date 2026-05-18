# Tasks: Expose Planner Candidate Diagnostics UI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120-220 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Show candidate diagnostics in planner UI | PR 1 | Includes component, styles, tests, specs. |

## Phase 1: Tests First

- [x] 1.1 Add web test for winning candidate and candidate rows.
- [x] 1.2 Add web test for missing diagnostics rendering nothing.

## Phase 2: Implementation

- [x] 2.1 Add `PlanCandidateDiagnosticsPanel` in `planner-ui.tsx`.
- [x] 2.2 Render diagnostics panel from `PlanDetail`.
- [x] 2.3 Add compact diagnostics styles in `styles.css`.

## Phase 3: Verification

- [x] 3.1 Run focused planner UI tests.
- [x] 3.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 3.3 Run `npm run test --workspace @camiones/web`.
