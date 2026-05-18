# Design: Planner Constraints Scoring MVP

## Technical Approach

Add a pure `LoadingPlanEvaluator` under `apps/api/src/domain/loading-planner/`. The planner keeps generating the same first-fit layout, then sends `input + placedItems + unplacedItems + base metrics/alerts` to the evaluator. The evaluator returns score, hard violations, soft penalties, and additive alerts.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Placement behavior | Preserve current heuristic | Multi-candidate search | MVP needs measurement before optimization. |
| Evaluator shape | Pure domain service | Nest provider | Easier unit tests and future optimizer reuse. |
| Persistence | Domain result only | Prisma migration | Avoid schema churn until score proves useful. |
| Zone max weight | Critical evaluator alert | Placement-time filtering | First show violations without changing placement. |

## Data Flow

    HeuristicLoadingPlanner.generate()
      -> place units as today
      -> build base alerts/metrics
      -> LoadingPlanEvaluator.evaluate(input, result)
      -> return result with evaluation + merged alerts/metrics

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `loading-plan-evaluator.ts` | Create | Pure constraint/scoring evaluator. |
| `loading-plan-evaluator.spec.ts` | Create | Unit tests for score and constraints. |
| `loading-planner.types.ts` | Modify | Add evaluation/score result types. |
| `heuristic-loading-planner.ts` | Modify | Invoke evaluator after placement. |
| `heuristic-loading-planner.spec.ts` | Modify | Assert behavior still passes and score exists. |

## Interfaces / Contracts

```ts
interface PlannerEvaluation {
  score: number;
  hardViolationCount: number;
  softPenaltyTotal: number;
  penalties: Array<{ code: string; points: number; message: string }>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Evaluator score/penalties/zone max | Vitest pure tests |
| Unit | Planner integration | Existing planner spec plus score assertions |
| Regression | API suite | `npm run test:api` |

## Migration / Rollout

No migration required.

## Open Questions

- None
