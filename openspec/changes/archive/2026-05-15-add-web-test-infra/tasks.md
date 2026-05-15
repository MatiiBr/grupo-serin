# Tasks: Add Web Test Infrastructure

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
| 1 | Add web test runner and baseline route tests | PR 1 | Includes config, tests, verification. |

## Phase 1: Test Dependencies

- [x] 1.1 Add web `test` script and dev dependencies.
- [x] 1.2 Add `apps/web/vitest.config.ts` with jsdom setup.
- [x] 1.3 Add `apps/web/src/test/setup.ts`.

## Phase 2: Baseline Test

- [x] 2.1 Add `apps/web/src/App.test.tsx` route smoke test.
- [x] 2.2 Ensure tests isolate React Query client per test.

## Phase 3: Capability Cache

- [x] 3.1 Update `openspec/config.yaml` testing capabilities for web tests.

## Phase 4: Verification

- [x] 4.1 Run `npm run test --workspace @camiones/web`.
- [x] 4.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 4.3 Run `npm run test:api`.
