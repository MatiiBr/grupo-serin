# Design: Planner Candidate Diagnostics

## Technical Approach

Add optional, transient diagnostics to `LoadingPlannerResult`. Candidate generation already evaluates every candidate; retain compact summaries from that loop and attach them to the selected result.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Storage | Transient result only | Persist JSON diagnostics | Avoid migration and stale historical data. |
| Shape | Compact candidate summaries | Full placements for every candidate | Keeps DTO small and reviewable. |
| Naming | Strategy names in code | Anonymous indexes only | Names make diagnostics useful for humans and later UI. |
| API | Optional field | Required field | Older/persisted responses must remain compatible. |

## Data Flow

    candidate orderings
      -> evaluate candidate result
      -> summarize score/counts
      -> select best candidate
      -> attach diagnostics to winning result
      -> DTO includes diagnostics when present

## Candidate Diagnostic Shape

```ts
interface PlannerCandidateSummary {
  index: number;
  name: string;
  score: number;
  hardViolationCount: number;
  placedItemCount: number;
  unplacedItemCount: number;
}

interface PlannerCandidateDiagnostics {
  winnerIndex: number;
  winnerName: string;
  candidates: PlannerCandidateSummary[];
}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `loading-planner.types.ts` | Modify | Add optional diagnostic types. |
| `heuristic-loading-planner.ts` | Modify | Name candidates and attach diagnostics after selection. |
| `heuristic-loading-planner.spec.ts` | Modify | Test winner metadata, summaries, and stable tie visibility. |
| `loading-plans.service.ts` | Modify | Pass optional diagnostics through `generate()` by adding an optional diagnostics argument to `toDto`. |
| `apps/web/src/api/types.ts` | Modify | Add optional diagnostics response type. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Domain diagnostics | Planner spec asserts winner and candidate summaries. |
| Unit/API | DTO optional pass-through | Focused DTO helper test around generated-plan diagnostics output. |
| Regression | API suite | `npm run test:api`. |
| Type | API/web contract | API and web typecheck. |

## Migration / Rollout

No migration required. Diagnostics are optional and only present for new generated results.

## Open Questions

- None
