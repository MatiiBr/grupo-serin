# Tasks: Centralize Web Query Keys

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
| 1 | Introduce queryKeys and migrate web usages | PR 1 | Verify with grep and typecheck. |

## Phase 1: Key Module

- [x] 1.1 Create `apps/web/src/api/queryKeys.ts` with all current web query key tuples.

## Phase 2: Migrate Usages

- [x] 2.1 Replace operations feature query and invalidation keys.
- [x] 2.2 Replace lifecycle query and invalidation keys.
- [x] 2.3 Update generic delete mutation typing for readonly tuple keys if needed.

## Phase 3: Verification

- [x] 3.1 Confirm no inline query key arrays remain in web source.
- [x] 3.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 3.3 Run `npm run test:api`.
