# Proposal: Centralize Web Query Keys

## Intent

Remove duplicated React Query key literals from web pages and components. Centralized keys reduce cache invalidation drift as the frontend continues splitting into features.

## Scope

### In Scope
- Add a shared `queryKeys` module for web React Query keys.
- Replace inline `queryKey: [...]` and matching invalidations in web code.
- Preserve all current query scopes and cache behavior.

### Out of Scope
- Changing API fetchers or payloads.
- Adding stores/reducers.
- Refactoring forms or lifecycle page structure.

## Capabilities

### New Capabilities
- `web-query-cache`: Web query cache key naming and invalidation contracts.

### Modified Capabilities
- None

## Approach

Create `apps/web/src/api/queryKeys.ts` with stable key builders and migrate current pages/hooks/components to import keys from it.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/api/queryKeys.ts` | New | Central query key factories. |
| `apps/web/src/features/operations/` | Modified | Replace operation-related key literals. |
| `apps/web/src/features/lifecycle/LifecyclePage.tsx` | Modified | Replace lifecycle key literals. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cache mismatch | Medium | Preserve exact tuple values; verify by grep and typecheck. |
| Over-abstraction | Low | Keep key builders simple and flat. |

## Rollback Plan

Revert the change commit to restore inline query keys.

## Dependencies

- Completed operations feature split.

## Success Criteria

- [ ] Query keys live in `apps/web/src/api/queryKeys.ts`.
- [ ] Web source has no inline React Query array literals for known keys.
- [ ] Existing query key tuple values are preserved.
- [ ] `npm run typecheck --workspace @camiones/web` passes.
