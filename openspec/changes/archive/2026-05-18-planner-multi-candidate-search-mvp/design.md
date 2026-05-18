# Design: Planner Multi-Candidate Search MVP

## Technical Approach

Refactor `HeuristicLoadingPlanner.generate()` into a small candidate pipeline. Each candidate is only a different ordering of expanded units; placement, alerts, metrics, and scoring reuse existing logic. The returned result is the best evaluated candidate.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Candidate type | Unit orderings only | New placement algorithms | Keeps MVP small and deterministic. |
| Strategies | current, light-first, volume-first, target-zone grouped | Random search | Easy to reason about and test. |
| Selection | score, hard violations, placed count, candidate index | score only | Avoid unstable ties and preserve current behavior when equal. |
| Metadata | Keep internal only | Add API fields | UI already shows score; candidate diagnostics can wait. |

## Data Flow

    input
      -> expand units
      -> build candidate orderings
      -> place/evaluate each candidate
      -> select best result
      -> return existing LoadingPlannerResult

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `heuristic-loading-planner.ts` | Modify | Extract candidate generation, candidate evaluation, best selection. |
| `heuristic-loading-planner.spec.ts` | Modify | Add winning alternate and stable compatibility tests. |

## Interfaces / Contracts

No public API shape change. Internal candidate result shape:

```ts
interface CandidateResult {
  index: number;
  result: LoadingPlannerResult;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Alternate candidate can win | Vitest planner spec with constrained zones |
| Unit | Existing behavior | Existing planner tests |
| Regression | API suite | `npm run test:api` |

## Migration / Rollout

No migration required.

## Open Questions

- None
