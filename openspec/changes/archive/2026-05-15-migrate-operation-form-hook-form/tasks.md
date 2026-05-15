# Tasks: Migrate Operation Form To React Hook Form

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 100-180 |
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
| 1 | Migrate operation creation form and test payload | PR 1 | Keep other forms manual. |

## Phase 1: Dependency

- [x] 1.1 Add `react-hook-form` to `@camiones/web`.

## Phase 2: Form Migration

- [x] 2.1 Replace manual `FormData` submit in `OperationsPage.tsx` with `useForm`.
- [x] 2.2 Preserve existing input names, labels, default time, mutation, and navigation behavior.

## Phase 3: Tests

- [x] 3.1 Add web test for successful operation creation payload mapping.
- [x] 3.2 Keep existing route smoke tests passing.

## Phase 4: Verification

- [x] 4.1 Run `npm run test --workspace @camiones/web`.
- [x] 4.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 4.3 Run `npm run test:api`.
