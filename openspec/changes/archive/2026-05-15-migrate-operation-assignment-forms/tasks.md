# Tasks: Migrate Operation Assignment Forms

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180-320 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single operations-form PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Migrate operation assignment forms | PR 1 | Tests included. |

## Phase 1: Form Migration

- [x] 1.1 Migrate `TruckPage.tsx` vehicle form to `useForm`.
- [x] 1.2 Migrate `DestinationsPage.tsx` destination form to `useForm`.
- [x] 1.3 Migrate `ProductsPage.tsx` product form to `useForm`.

## Phase 2: Cleanup

- [x] 2.1 Remove unused manual submit helpers and imports from `operation-ui.tsx`.

## Phase 3: Tests

- [x] 3.1 Add runtime tests for migrated assignment form payloads.
- [x] 3.2 Keep existing operation creation tests passing.

## Phase 4: Verification

- [x] 4.1 Run `npm run test --workspace @camiones/web`.
- [x] 4.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 4.3 Run `npm run test:api`.
