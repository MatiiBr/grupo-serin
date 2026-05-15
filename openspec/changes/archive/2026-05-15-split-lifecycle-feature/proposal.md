# Proposal: Split Lifecycle Feature

## Intent

Remove the remaining lifecycle monolith by splitting `LifecyclePage.tsx` into route pages, shared components, hooks, and form submit helpers before migrating lifecycle forms.

## Scope

### In Scope
- Split `LifecyclePage`, `OrdersPage`, and `DispatchPage` into dedicated page modules.
- Move shared lifecycle lists/metrics into `components/`.
- Move lifecycle mutation hooks into `hooks/`.
- Move existing manual submit helpers into `forms/` temporarily.
- Preserve current behavior and routes.

### Out of Scope
- Migrating lifecycle forms to `react-hook-form`.
- UI redesign or API changes.
- Store/reducer introduction.

## Capabilities

### New Capabilities
- `lifecycle-feature-structure`: Source organization rules for lifecycle/order/dispatch frontend feature.

### Modified Capabilities
- None

## Approach

Move code by responsibility and expose pages through `features/lifecycle/index.ts`. Keep manual form helpers unchanged, only relocated.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `features/lifecycle/LifecyclePage.tsx` | Removed | Replace monolithic file. |
| `features/lifecycle/pages/` | New | Route page modules. |
| `features/lifecycle/components/` | New | Lists and metrics. |
| `features/lifecycle/hooks/` | New | Status mutation hooks. |
| `features/lifecycle/forms/` | New | Existing submit helpers. |
| `apps/web/src/App.tsx` | Modified | Import lifecycle pages from feature barrel. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Import regression | Medium | Use barrel exports and typecheck. |
| Review noise | Medium | No behavior changes; moved-code-only intent. |

## Rollback Plan

Revert this change commit to restore the previous lifecycle file.

## Dependencies

- Existing routing and query key refactors.

## Success Criteria

- [ ] `LifecyclePage.tsx` no longer exists.
- [ ] Lifecycle route pages live under `features/lifecycle/pages/`.
- [ ] Shared lists/hooks/forms are separated by responsibility.
- [ ] Web tests, web typecheck, and API tests pass.
