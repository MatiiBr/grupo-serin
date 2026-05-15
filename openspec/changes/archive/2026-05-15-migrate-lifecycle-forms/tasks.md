# Tasks: Migrate Lifecycle Forms

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 140-260 |
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
| 1 | Migrate lifecycle intake forms | PR 1 | Includes tests. |

## Phase 1: Form Migration

- [x] 1.1 Migrate customer form in `OrdersPage.tsx` to `useForm`.
- [x] 1.2 Migrate order form in `OrdersPage.tsx` to `useForm`.
- [x] 1.3 Remove obsolete manual lifecycle submit helpers.

## Phase 2: Tests

- [x] 2.1 Add customer submit payload test.
- [x] 2.2 Add order submit payload test.
- [x] 2.3 Keep existing web tests passing.

## Phase 3: Verification

- [x] 3.1 Run `npm run test --workspace @camiones/web`.
- [x] 3.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 3.3 Run `npm run test:api`.
