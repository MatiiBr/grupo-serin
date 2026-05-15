# Tasks: Web App Routing Structure

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180-300 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single branch/PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Replace manual routing with React Router and minimal bootstrap | PR 1 | Verify with web typecheck. |

## Phase 1: Dependency And Router Foundation

- [x] 1.1 Add `react-router-dom` to `apps/web/package.json` and lockfile.
- [x] 1.2 Update `apps/web/src/lib/navigation.ts` to expose a router-backed navigation bridge.

## Phase 2: App Shell Extraction

- [x] 2.1 Create `apps/web/src/App.tsx` with shell header, top nav, and route declarations.
- [x] 2.2 Add operation route wrapper components using `useParams()` for existing operation pages.
- [x] 2.3 Move not-found rendering into the route table.

## Phase 3: Entrypoint Cleanup

- [x] 3.1 Remove manual `RouteName`, `parseRoute`, and `useRoute` from `apps/web/src/main.tsx`.
- [x] 3.2 Keep `main.tsx` limited to `StrictMode`, `QueryClientProvider`, `BrowserRouter`, and `<App />`.
- [x] 3.3 Move existing operation page components into `apps/web/src/features/operations/OperationPages.tsx` for router composition.

## Phase 4: Router Integration

- [x] 4.1 Replace top-level active nav logic with `NavLink` state.
- [x] 4.2 Replace operation header active route logic with `useLocation()` path matching.
- [x] 4.3 Ensure existing `navigate(path)` calls route through React Router.

## Phase 5: Verification

- [x] 5.1 Verify spec scenarios by route table review for `/`, `/operations`, operation children, and unknown paths.
- [x] 5.2 Run `npm run typecheck --workspace @camiones/web`.
- [x] 5.3 Confirm no normal UI code dispatches synthetic `PopStateEvent`.
