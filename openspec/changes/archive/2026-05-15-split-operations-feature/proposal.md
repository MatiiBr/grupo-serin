# Proposal: Split Operations Feature

## Intent

Remove the temporary `OperationPages.tsx` parking file by splitting the operations feature into pages, components, hooks, and planner/report modules. This is the next refactor after moving routing out of `main.tsx`.

## Scope

### In Scope
- Split exported operation pages into dedicated files.
- Move shared operation UI into `components/`.
- Move operation hooks/helpers into `hooks/` or local utility modules.
- Keep existing routes, payloads, and visible behavior unchanged.

### Out of Scope
- Migrating forms to `react-hook-form`.
- Introducing global stores/reducers.
- Changing API contracts or backend behavior.

## Capabilities

### New Capabilities
- `operations-feature-structure`: Source organization rules for the operations frontend feature.

### Modified Capabilities
- None

## Approach

Create a feature-local structure under `apps/web/src/features/operations/` and move code by responsibility, preserving imports and behavior. Keep this as a refactor-only change verified by typecheck and route import compatibility.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/features/operations/OperationPages.tsx` | Removed | Replace monolithic parking file. |
| `apps/web/src/features/operations/pages/` | New | Dedicated page modules. |
| `apps/web/src/features/operations/components/` | New | Shared operation, planner, report components. |
| `apps/web/src/features/operations/hooks/` | New | Feature-local data hooks. |
| `apps/web/src/App.tsx` | Modified | Import pages from feature index. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Import regression | Medium | Use barrel exports and web typecheck. |
| Review noise from moved code | Medium | Avoid behavioral edits; keep commits as one structural work unit. |

## Rollback Plan

Revert the change branch commit to restore the previous temporary operations file.

## Dependencies

- Prior `web-app-routing-structure` change merged locally into `develop`.

## Success Criteria

- [ ] `OperationPages.tsx` no longer exists.
- [ ] Operations pages live under `features/operations/pages/`.
- [ ] Shared UI/hook code is not embedded in page files unless page-specific.
- [ ] Existing route imports in `App.tsx` continue to work.
- [ ] `npm run typecheck --workspace @camiones/web` passes.
