# Proposal: Web App Routing Structure

## Intent

Reduce frontend architecture debt by separating React bootstrap, shell routing, and operation pages currently concentrated in `apps/web/src/main.tsx`. This enables safe follow-up changes for form handling, hooks, and feature-level components.

## Scope

### In Scope
- Move app shell/routing out of `main.tsx` into dedicated app-level modules.
- Introduce `react-router-dom` for declarative web routing.
- Preserve existing URLs and behavior for operations, lifecycle, orders, dispatch, planner, and report pages.

### Out of Scope
- Migrating forms to `react-hook-form`.
- Splitting every operation component into final feature folders.
- Changing API behavior or backend routes.

## Capabilities

### New Capabilities
- `web-routing`: Web application route composition and navigation shell.

### Modified Capabilities
- None

## Approach

Install and wire `react-router-dom`, replace manual `parseRoute`/`popstate` routing, and keep page components behaviorally equivalent while extracting only the app bootstrap and route composition needed for the change.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/main.tsx` | Modified | Keep React root/bootstrap only. |
| `apps/web/src/App.tsx` | New | Own shell layout and route declarations. |
| `apps/web/src/lib/navigation.ts` | Modified/Removed | Replace custom navigation with router APIs. |
| `apps/web/package.json` | Modified | Add router dependency. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Route regression | Medium | Preserve URL table and verify typecheck plus manual route mapping. |
| Oversized refactor | Medium | Limit this change to routing/bootstrap extraction; defer feature folder cleanup. |

## Rollback Plan

Revert the change branch commit(s) to restore manual routing and previous `main.tsx` composition.

## Dependencies

- `react-router-dom`

## Success Criteria

- [ ] `main.tsx` no longer contains route parsing or page routing logic.
- [ ] Existing route paths still render equivalent pages.
- [ ] Custom `window.history` navigation is removed from normal UI flows.
- [ ] `npm run typecheck --workspace @camiones/web` passes.
