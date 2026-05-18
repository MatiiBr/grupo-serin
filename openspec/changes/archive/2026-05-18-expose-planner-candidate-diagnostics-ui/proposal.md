# Proposal: Expose Planner Candidate Diagnostics UI

## Intent

Make planner candidate selection understandable in the web planner. The API now returns candidate diagnostics, but operators still only see the final score and cannot tell which strategy won or how alternatives compared.

## Scope

### In Scope
- Render candidate winner metadata in the planner detail view.
- Show compact candidate comparison rows: name, score, hard violations, placed/unplaced counts.
- Keep the planner usable when diagnostics are absent.

### Out of Scope
- New backend diagnostics fields.
- New candidate strategies or scoring rules.
- Persistence changes.
- Advanced charts or candidate placement replay.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `planner-evaluation-visibility`: Add web visibility for optional candidate diagnostics.

## Approach

Add a small `PlanCandidateDiagnosticsPanel` beside the existing score panel. Reuse current visual language: dark operational cards, amber winner accents, compact rows for alternatives.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/features/operations/components/planner-ui.tsx` | Modified | Render diagnostics panel in `PlanDetail`. |
| `apps/web/src/features/operations/components/planner-ui.test.tsx` | Modified | Cover diagnostics present and absent. |
| `apps/web/src/styles.css` | Modified | Add compact comparison styling. |
| `openspec/specs/planner-evaluation-visibility/spec.md` | Modified | Add UI diagnostics requirement. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Panel overwhelms score view | Medium | Keep summaries compact and below metrics. |
| Older plans lack diagnostics | Low | Component returns null when absent. |

## Rollback Plan

Revert the UI panel, tests, styles, and spec delta. No data rollback required.

## Dependencies

- Existing `candidateDiagnostics` API response field.

## Success Criteria

- [x] Planner UI shows winning candidate name and index when diagnostics exist.
- [x] Planner UI lists candidate score summaries.
- [x] Planner UI renders unchanged when diagnostics are absent.
