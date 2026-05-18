# Design: Expose Planner Candidate Diagnostics UI

## Technical Approach

Add an exported `PlanCandidateDiagnosticsPanel` component in `planner-ui.tsx` and render it next to `PlanEvaluationPanel` inside `PlanDetail`. The component is presentational and returns `null` when diagnostics are missing.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Placement | Same card as score panel | Separate tab | Keeps quality signals together. |
| Component | Exported presentational component | Inline JSX in `PlanDetail` | Easier focused tests and smaller render logic. |
| Content | Compact rows | Charts | Diagnostics are few and textual; charts can wait. |
| Absent data | Return `null` | Empty-state box | Older plans should not create noise. |

## Data Flow

    LoadingPlan.candidateDiagnostics
      -> PlanDetail
      -> PlanCandidateDiagnosticsPanel
      -> winner summary + candidate rows

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/features/operations/components/planner-ui.tsx` | Modify | Add and render diagnostics panel. |
| `apps/web/src/features/operations/components/planner-ui.test.tsx` | Modify | Add tests for visible and absent diagnostics. |
| `apps/web/src/styles.css` | Modify | Style diagnostics panel and winner row. |
| `openspec/specs/planner-evaluation-visibility/spec.md` | Modify | Promote UI diagnostics requirement. |

## Interfaces / Contracts

Uses existing `LoadingPlanCandidateDiagnostics` from `apps/web/src/api/types.ts`. No API changes.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Web unit | Diagnostics visible | Testing Library render of exported panel. |
| Web unit | Missing diagnostics | Assert empty render. |
| Regression | Existing planner tests | Existing form and evaluation panel tests. |
| Type | Web contract | `npm run typecheck --workspace @camiones/web`. |

## Migration / Rollout

No migration required.

## Open Questions

- None
