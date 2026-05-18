# Tasks: Expose Planner Evaluation UI

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
| 1 | Expose planner evaluation API + UI | PR 1 | Includes tests and specs. |

## Phase 1: Tests First

- [x] 1.1 Add API helper test for evaluation summary from metrics/alerts.
- [x] 1.2 Add web component test for score and penalties panel.

## Phase 2: API + Types

- [x] 2.1 Create `loading-plan-evaluation.dto.ts` helper.
- [x] 2.2 Include `evaluation` in loading plan DTO.
- [x] 2.3 Add web `LoadingPlanEvaluation` types.

## Phase 3: UI

- [x] 3.1 Add `PlanEvaluationPanel` to `planner-ui.tsx`.
- [x] 3.2 Style evaluation panel in `styles.css`.

## Phase 4: Verification

- [x] 4.1 Run focused API/web tests.
- [x] 4.2 Run API and web typechecks.
- [x] 4.3 Run API and web tests.
