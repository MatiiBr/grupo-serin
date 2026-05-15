# Design: Add Web Test Infrastructure

## Technical Approach

Add Vitest to `@camiones/web` with jsdom and Testing Library. Write a focused `App` route smoke test using `MemoryRouter` and `QueryClientProvider`.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Runner | Vitest | Jest | API already uses Vitest; Vite app integration is straightforward. |
| DOM env | jsdom | happy-dom | Testing Library defaults and ecosystem docs align with jsdom. |
| First test | App routing smoke test | Deep planner test | Routing is the current architecture foundation and safer for initial infra. |

## Data Flow

    test -> QueryClientProvider -> MemoryRouter -> App -> route component

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/package.json` | Modify | Add test script and dev dependencies. |
| `apps/web/vitest.config.ts` | Create | Configure jsdom and setup file. |
| `apps/web/src/test/setup.ts` | Create | Import Testing Library matchers. |
| `apps/web/src/App.test.tsx` | Create | Verify app routes render. |
| `openspec/config.yaml` | Modify | Mark web test layer available. |

## Interfaces / Contracts

```json
{ "scripts": { "test": "vitest run" } }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Web component | App route rendering | `npm run test --workspace @camiones/web` |
| Typecheck | Test config/types | `npm run typecheck --workspace @camiones/web` |
| Regression | Existing API suite | `npm run test:api` |

## Migration / Rollout

No migration required.

## Open Questions

- None
