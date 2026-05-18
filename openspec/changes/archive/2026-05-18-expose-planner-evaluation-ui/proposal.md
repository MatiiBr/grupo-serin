# Proposal: Expose Planner Evaluation UI

## Intent

Make planner scoring useful to users by exposing evaluation details through the API DTO and displaying them in the planner UI.

## Scope

### In Scope
- Add evaluation summary to loading plan API responses.
- Add web API types for planner evaluation.
- Show score, hard violations, and penalties in `PlanDetail`.
- Add focused tests for DTO summary and UI rendering.

### Out of Scope
- Persisting score in Prisma.
- Changing scorer weights.
- Multi-candidate optimization.
- Report PDF changes.

## Capabilities

### New Capabilities
- `planner-evaluation-visibility`: API and UI visibility for planner score/evaluation details.

### Modified Capabilities
- None

## Approach

Reconstruct an evaluation summary from stored plan metrics and alerts for API responses, then render it as an industrial quality panel beside existing metrics/alerts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/loading-plans/` | Modified | Add evaluation DTO summary helper and response field. |
| `apps/web/src/api/types.ts` | Modified | Add evaluation response types. |
| `apps/web/src/features/operations/components/planner-ui.tsx` | Modified | Render score/penalties panel. |
| `apps/web/src/styles.css` | Modified | Style evaluation panel within existing industrial theme. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Score differs from in-memory evaluator | Medium | Reconstruct from persisted metrics/alerts and keep labels clear. |
| UI noise | Low | Put compact summary near metrics and detailed penalties in a small list. |

## Rollback Plan

Revert this change commit to remove API evaluation field and UI panel.

## Dependencies

- `planner-constraints-scoring-mvp` merged.

## Success Criteria

- [x] Loading plan DTO includes evaluation summary.
- [x] Planner UI shows score, hard violations, and penalties.
- [x] Tests and typechecks pass.
