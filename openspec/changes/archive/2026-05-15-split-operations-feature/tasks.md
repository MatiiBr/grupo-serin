# Tasks: Split Operations Feature

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 850-1100 mostly moved code |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single structural move after prior router split |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Split operations feature monolith without behavior changes | PR 1 | Size exception accepted by instruction to continue. |

## Phase 1: Module Structure

- [x] 1.1 Create `pages/`, `components/`, and `hooks/` folders under `features/operations/`.
- [x] 1.2 Create `features/operations/index.ts` as the page export boundary.

## Phase 2: Page Extraction

- [x] 2.1 Move `OperationsPage`, `OperationPage`, `TruckPage`, `DestinationsPage`, `ProductsPage`, `PlannerPage`, and `ReportPage` into dedicated page files.
- [x] 2.2 Update `App.tsx` to import pages from `features/operations`.

## Phase 3: Component And Hook Extraction

- [x] 3.1 Move shared operation chrome/list/table components into `components/operation-ui.tsx`.
- [x] 3.2 Move planner-specific components/helpers into `components/planner-ui.tsx`.
- [x] 3.3 Move report-specific components into `components/report-ui.tsx`.
- [x] 3.4 Move `useOperation` and `useDeleteMutation` into `hooks/operationHooks.ts`.

## Phase 4: Cleanup And Verification

- [x] 4.1 Delete `OperationPages.tsx`.
- [x] 4.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 4.3 Run `npm run test:api`.
