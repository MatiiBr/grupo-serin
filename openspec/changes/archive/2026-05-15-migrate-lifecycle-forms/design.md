# Design: Migrate Lifecycle Forms

## Technical Approach

Use two local `useForm` instances in `OrdersPage`, one for customer creation and one for order creation. Keep dispatch actions as direct button mutations.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Scope | Customer and order forms only | Include dispatch actions | Dispatch has button actions, not forms. |
| Location | Page-local form mapping | Keep helper module | Mapping depends on page queries and selected product lookup. |
| Validation | Native required only | Add schema validation | Preserve existing behavior; schema later. |

## Data Flow

    registered inputs -> handleSubmit -> local payload mapper -> React Query mutation

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `OrdersPage.tsx` | Modify | Add useForm and local submit mappers. |
| `lifecycleForms.ts` | Delete/empty | Remove obsolete manual helpers. |
| `App.test.tsx` | Modify | Add customer/order submit tests. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Web component | Customer/order payload mapping | Testing Library with mocked APIs |
| Typecheck | Form value types | `npm run typecheck --workspace @camiones/web` |
| Regression | API suite | `npm run test:api` |

## Migration / Rollout

No migration required.

## Open Questions

- None
