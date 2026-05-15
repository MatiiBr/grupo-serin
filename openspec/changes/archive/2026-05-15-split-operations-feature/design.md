# Design: Split Operations Feature

## Technical Approach

Split `OperationPages.tsx` by responsibility while preserving page exports through a feature barrel. Keep behavior unchanged: this is a module-boundary refactor only.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Page boundary | One file per route page under `pages/` | Keep grouped page file | Route pages are easier to review and change independently. |
| Shared UI | Put reused operation UI in `components/` | Keep helpers near pages | Header, rows, metrics, lists, planner widgets, and report tables are not page-owned. |
| Hooks | Put feature query/mutation helpers in `hooks/` | Global hooks folder | Hooks are operation-specific and should stay close to the feature. |
| Barrel export | Add `features/operations/index.ts` | Import every page path from `App.tsx` | Keeps route composition stable and hides internal layout. |

## Data Flow

    App.tsx
      -> features/operations barrel
      -> pages/*Page
      -> components/* + hooks/*

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `features/operations/OperationPages.tsx` | Delete | Remove temporary monolith. |
| `features/operations/index.ts` | Create | Export route pages. |
| `features/operations/pages/*.tsx` | Create | Route page modules. |
| `features/operations/components/*.tsx` | Create | Shared UI modules. |
| `features/operations/hooks/*.ts` | Create | Feature data hooks/mutations. |
| `apps/web/src/App.tsx` | Modify | Import pages from feature barrel. |

## Interfaces / Contracts

```ts
export { OperationsPage } from './pages/OperationsPage';
export { OperationPage } from './pages/OperationPage';
export { TruckPage } from './pages/TruckPage';
export { DestinationsPage } from './pages/DestinationsPage';
export { ProductsPage } from './pages/ProductsPage';
export { PlannerPage } from './pages/PlannerPage';
export { ReportPage } from './pages/ReportPage';
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Typecheck | Imports and props | `npm run typecheck --workspace @camiones/web` |
| Regression | Existing backend tests | `npm run test:api` |
| Runtime web | Route behavior | Not available until web test infrastructure exists. |

## Migration / Rollout

No migration required.

## Open Questions

- None
