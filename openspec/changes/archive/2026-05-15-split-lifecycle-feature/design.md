# Design: Split Lifecycle Feature

## Technical Approach

Split `LifecyclePage.tsx` into feature-local page, component, hook, and form modules. Preserve behavior exactly and keep form migration for a later SDD change.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Page boundary | `pages/LifecyclePage.tsx`, `pages/OrdersPage.tsx`, `pages/DispatchPage.tsx` | Keep combined file | Matches operations feature structure. |
| Shared UI | `components/lifecycle-ui.tsx` | One component per tiny list | Keeps small shared presentational pieces together. |
| Hooks/forms | `hooks/lifecycleHooks.ts`, `forms/lifecycleForms.ts` | Leave near pages | Separates state effects and parsing before `useForm` migration. |
| Barrel | `features/lifecycle/index.ts` | Import page internals in `App.tsx` | Keeps routing independent from internal layout. |

## Data Flow

    App.tsx -> features/lifecycle barrel -> pages -> components/hooks/forms

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `LifecyclePage.tsx` | Delete | Remove monolith. |
| `pages/*.tsx` | Create | Route-level pages. |
| `components/lifecycle-ui.tsx` | Create | Metrics and lists. |
| `hooks/lifecycleHooks.ts` | Create | Status mutation hooks. |
| `forms/lifecycleForms.ts` | Create | Existing submit helpers. |
| `index.ts` | Create | Feature page exports. |
| `App.tsx` | Modify | Import lifecycle pages from barrel. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Web runtime | Existing app route smoke tests | `npm run test --workspace @camiones/web` |
| Typecheck | Import boundaries | `npm run typecheck --workspace @camiones/web` |
| Regression | API suite | `npm run test:api` |

## Migration / Rollout

No migration required.

## Open Questions

- None
