# Proposal: Planner Candidate Diagnostics

## Intent

Make planner optimization explainable before adding more heuristics, constraints, or UI decisions. The planner can now compare candidates, but callers cannot inspect which candidate won or why alternatives lost.

## Scope

### In Scope
- Add internal candidate diagnostics to generated planner results.
- Include winner metadata and compact score summaries for evaluated candidates.
- Expose diagnostics in API DTOs for newly generated plans.

### Out of Scope
- New candidate strategies.
- New scoring penalties or constraints.
- Web UI changes beyond API type readiness.
- Database migrations or persisted candidate diagnostics.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `planner-multi-candidate-search`: Add inspectable candidate diagnostics for multi-candidate generation.
- `planner-evaluation-visibility`: Allow API responses to include optional candidate diagnostics.

## Approach

Extend the domain result with optional `candidateDiagnostics`. Keep diagnostics transient for generated plans and reconstruct nothing for older persisted plans. API DTOs pass diagnostics through when present.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/domain/loading-planner` | Modified | Add candidate diagnostic types and populate them during search. |
| `apps/api/src/loading-plans` | Modified | Include optional diagnostics in generated plan DTOs. |
| `apps/web/src/api/types.ts` | Modified | Add optional response type readiness. |
| `openspec/specs` | Modified | Update planner behavior contracts. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DTO shape grows too much | Medium | Return compact summaries only. |
| Persisted plans look inconsistent | Low | Diagnostics remain optional and absent for older plans. |

## Rollback Plan

Revert the optional diagnostics fields and DTO mapping. No migration rollback is required.

## Dependencies

- Existing planner scoring and multi-candidate search.

## Success Criteria

- [x] Generated planner results include winner index/name and evaluated candidate summaries.
- [x] API DTOs include diagnostics only when available.
- [x] Existing responses remain valid when diagnostics are absent.
