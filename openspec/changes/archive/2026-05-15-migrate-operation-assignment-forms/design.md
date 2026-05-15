# Design: Migrate Operation Assignment Forms

## Technical Approach

Add `useForm` to each assignment page and keep payload conversion local to the page. Remove shared `FormData` submit helpers from `operation-ui.tsx` once no longer used.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Scope | Operations assignment forms only | Include lifecycle forms | Keeps branch focused and reviewable. |
| Mapping | Local mapper functions per page | Generic form mapper | Payloads differ; local mapping is clearer. |
| Validation | Native `required` only | Add schema validation | Existing behavior has minimal validation; schema comes later. |

## Data Flow

    registered inputs -> handleSubmit -> local mapper -> React Query mutation -> API client

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `TruckPage.tsx` | Modify | Vehicle assignment useForm. |
| `DestinationsPage.tsx` | Modify | Destination assignment useForm. |
| `ProductsPage.tsx` | Modify | Product assignment useForm. |
| `operation-ui.tsx` | Modify | Remove obsolete submit helpers/imports. |
| `App.test.tsx` | Modify | Add assignment submit tests. |

## Interfaces / Contracts

No API contract changes. Form value interfaces remain page-local.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Web component | Submit payload mapping | Testing Library with mocked APIs |
| Typecheck | RHF field types | `npm run typecheck --workspace @camiones/web` |
| Regression | API suite | `npm run test:api` |

## Migration / Rollout

No data migration required.

## Open Questions

- None
