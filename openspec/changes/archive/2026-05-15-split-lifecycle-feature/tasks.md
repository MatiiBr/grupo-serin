# Tasks: Split Lifecycle Feature

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-420 mostly moved code |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single structural PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Split lifecycle feature monolith | PR 1 | No behavior changes. |

## Phase 1: Module Structure

- [x] 1.1 Create lifecycle `pages/`, `components/`, `hooks/`, and `forms/` folders.
- [x] 1.2 Create `features/lifecycle/index.ts` barrel.

## Phase 2: Extraction

- [x] 2.1 Move route pages into dedicated page files.
- [x] 2.2 Move list/metric components into `components/lifecycle-ui.tsx`.
- [x] 2.3 Move mutation hooks into `hooks/lifecycleHooks.ts`.
- [x] 2.4 Move submit helpers into `forms/lifecycleForms.ts`.

## Phase 3: Integration

- [x] 3.1 Update `App.tsx` lifecycle imports.
- [x] 3.2 Delete `LifecyclePage.tsx`.

## Phase 4: Verification

- [x] 4.1 Run `npm run test --workspace @camiones/web`.
- [x] 4.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 4.3 Run `npm run test:api`.
