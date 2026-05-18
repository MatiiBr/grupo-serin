# Design: Expose Planner Evaluation UI

## Technical Approach

Add a pure API DTO helper that reconstructs an evaluation summary from persisted `PlanMetrics` and `LoadAlert` DTO data. Add optional `evaluation` to the web `LoadingPlan` type and render a compact score panel in `PlanDetail`.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Persistence | No Prisma migration | Store score fields | MVP only needs visibility; avoid schema churn. |
| Source | Reconstruct from metrics/alerts | Use in-memory generation only | Current plan endpoints load persisted plans. |
| UI placement | Near metrics | Alert-only section | Score is a plan summary, not only an error list. |
| Compatibility | Optional web field | Required field | Older/null responses should not break planner rendering. |

## Data Flow

    persisted metrics + alerts
      -> API evaluation DTO helper
      -> LoadingPlan.evaluation
      -> PlanEvaluationPanel

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/loading-plans/loading-plan-evaluation.dto.ts` | Create | Pure DTO scoring helper and tests. |
| `apps/api/src/loading-plans/loading-plans.service.ts` | Modify | Include evaluation in `toDto`. |
| `apps/web/src/api/types.ts` | Modify | Add evaluation types. |
| `apps/web/src/features/operations/components/planner-ui.tsx` | Modify | Add evaluation panel. |
| `apps/web/src/features/operations/components/planner-ui.test.tsx` | Modify | Test panel rendering. |
| `apps/web/src/styles.css` | Modify | Style score panel. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| API unit | Evaluation DTO summary | Vitest pure helper test |
| Web unit | Evaluation panel rendering | Testing Library component test |
| Regression | API/web suites | Existing test commands |

## Migration / Rollout

No migration required.

## Open Questions

- None
