# Tasks: Migrate Planner Form

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 110-220 |
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
| 1 | Migrate planner adjustment form | PR 1 | Includes tests and cleanup. |

## Phase 1: Tests

- [x] 1.1 Add planner adjustment payload mapping tests.

## Phase 2: Form Migration

- [x] 2.1 Migrate `SelectedItemPanel` adjustment form to `useForm`.
- [x] 2.2 Use the tested mapper for numeric and locked fields.
- [x] 2.3 Remove obsolete shared form helpers if unused.

## Phase 3: Verification

- [x] 3.1 Run `npm run test --workspace @camiones/web`.
- [x] 3.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 3.3 Run `npm run test:api`.
