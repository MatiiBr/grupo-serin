# Design: Web App Routing Structure

## Technical Approach

Use `react-router-dom` as the app router and move shell route composition out of `main.tsx`. Keep this slice intentionally narrow: move the existing operation page block as-is into a temporary feature module, then let route ownership and navigation move to router APIs.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Router library | `react-router-dom` with `BrowserRouter`, `Routes`, `Route`, `NavLink`, `useNavigate`, `useParams`, `useLocation` | Continue manual `pushState`; add another router | React Router is the standard fit for Vite/React and removes custom URL state. |
| Entrypoint boundary | `main.tsx` owns providers/root only; `App.tsx` owns shell/routes | Keep `App` in `main.tsx` | Makes bootstrap auditable and unlocks feature extraction later. |
| Compatibility bridge | Update `lib/navigation.ts` to delegate to an injectable navigate function during the transition | Rewrite every nested component in this change | Smaller diff; follow-up feature extraction can replace bridge calls with hooks/links. |
| Route params | Small wrapper components call `useParams()` and pass `operationId` to existing pages | Pass custom route object | Preserves existing page signatures and avoids broad page rewrites. |

## Data Flow

    main.tsx
      -> QueryClientProvider
      -> BrowserRouter
      -> App shell
      -> Routes
      -> Page wrappers
      -> Existing page components

Navigation flow:

    UI event -> navigate(path) bridge -> React Router navigate -> Route render

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/main.tsx` | Modify | Remove route parser/app shell and keep bootstrap minimal. |
| `apps/web/src/App.tsx` | Create | Define shell, top nav, route table, and operation route wrappers. |
| `apps/web/src/features/operations/OperationPages.tsx` | Create | Hold existing operation page implementations after moving them out of `main.tsx`. |
| `apps/web/src/lib/navigation.ts` | Modify | Replace manual history mutation with router-backed navigation bridge. |
| `apps/web/package.json` | Modify | Add `react-router-dom`. |
| `package-lock.json` | Modify | Lock router dependency. |

## Interfaces / Contracts

```ts
export function setNavigateHandler(handler: (path: string) => void): void;
export function navigate(path: string): void;
```

`navigate(path)` remains for existing components during this change but no longer dispatches synthetic browser events.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Route URL preservation | Type-level compilation via web typecheck. |
| Integration | Navigation shell render wiring | Covered by manual route table review; no web test runner installed. |
| E2E | Browser route behavior | Not available; defer until E2E tooling exists. |

## Migration / Rollout

No data migration required. Roll out as a web-only refactor preserving URL contracts.

## Open Questions

- None
