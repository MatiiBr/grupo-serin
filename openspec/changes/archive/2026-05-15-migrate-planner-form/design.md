# Design: Migrate Planner Form

## Technical Approach

Replace the selected-item adjustment form's inline `FormData` parser with `react-hook-form`. Extract a small payload mapper so the behavior can be tested without rendering the Three.js scene.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Test layer | Unit test mapper | Render full planner scene | Canvas/Three.js rendering is unrelated to payload mapping. |
| Location | Keep mapper beside planner UI | New generic forms helper | Mapper is planner-specific and should not recreate generic form utilities. |
| Cleanup | Delete `lib/forms.ts` if unused | Keep compatibility helpers | No external consumers; remove dead code after last usage. |

## Data Flow

    registered inputs -> handleSubmit -> adjustment mapper -> adjustPlacedItem mutation

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/features/operations/components/planner-ui.tsx` | Modify | Add `useForm`, mapper, and registered inputs. |
| `apps/web/src/features/operations/components/planner-ui.test.tsx` | Create | Test adjustment payload mapping. |
| `apps/web/src/lib/forms.ts` | Delete | Remove if no imports remain. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Adjustment payload mapping | Vitest test for numbers and checkbox boolean |
| Web suite | Regression | `npm run test --workspace @camiones/web` |
| Typecheck | Form value types | `npm run typecheck --workspace @camiones/web` |

## Migration / Rollout

No migration required.

## Open Questions

- None
