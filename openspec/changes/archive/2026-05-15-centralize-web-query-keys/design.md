# Design: Centralize Web Query Keys

## Technical Approach

Add a small `queryKeys` object in `apps/web/src/api/queryKeys.ts` and migrate all current web `queryKey` and `invalidateQueries` calls to it.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Location | `apps/web/src/api/queryKeys.ts` | `lib/` or per-feature key files | Query keys are API/cache contracts and used across features. |
| Shape | Flat grouped object with tuple factories | Classes, enums, string constants | Tuple factories preserve React Query key arrays and dynamic ids. |
| Scope | Migrate all current web inline keys | Only operations keys | Prevents half-pattern drift immediately. |

## Data Flow

    page/hook -> queryKeys.<domain> -> useQuery/invalidateQueries -> React Query cache

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/api/queryKeys.ts` | Create | Central key tuples. |
| `apps/web/src/features/operations/**` | Modify | Use query key builders. |
| `apps/web/src/features/lifecycle/LifecyclePage.tsx` | Modify | Use query key builders. |

## Interfaces / Contracts

```ts
export const queryKeys = {
  operations: { list: () => ['operations'] as const, detail: (id: string) => ['operation', id] as const },
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Typecheck | Tuple imports and invalidation calls | `npm run typecheck --workspace @camiones/web` |
| Regression | Existing backend suite | `npm run test:api` |

## Migration / Rollout

No migration required.

## Open Questions

- None
