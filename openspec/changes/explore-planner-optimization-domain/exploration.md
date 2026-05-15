# Exploration: Planner Optimization Domain MVP

## Current State

The backend already has a deterministic `HeuristicLoadingPlanner` used by `LoadingPlansService.generate()`.

Today it:
- Expands product quantities into individual units.
- Sorts by destination unloading order, then weight, then volume.
- Assigns target zones from unloading order: first stops near door, last stops near cabin.
- Places items only on the floor (`zMm = 0`) using first-fit XY positions.
- Allows 90-degree rotation when `rotationAllowed !== false`.
- Emits critical alerts for unplaced items and max payload excess.
- Emits warnings for lateral weight imbalance and zone concentration.
- Calculates metrics: volume utilization, placed/unplaced counts, side/zone weights, load length, max height, center of gravity.
- Manual adjustment recalculation additionally validates out-of-bounds and 3D overlaps.

Current limitation: generation is placement-first, not score-first. It does not compare candidate plans, does not enforce per-zone max weight, does not stack, and does not explicitly model MVP hard/soft constraints as a reusable contract.

## Affected Areas

- `apps/api/src/domain/loading-planner/heuristic-loading-planner.ts` — generation algorithm, alerts, metrics.
- `apps/api/src/domain/loading-planner/loading-planner.types.ts` — planner input/result contracts.
- `apps/api/src/domain/loading-planner/geometry.ts` — 2D bounds/overlap primitives.
- `apps/api/src/domain/loading-planner/heuristic-loading-planner.spec.ts` — current planner unit tests.
- `apps/api/src/loading-plans/loading-plans.service.ts` — persistence, manual adjustment validation, recalculated alerts/metrics.
- `apps/api/prisma/schema.prisma` — existing fields/enums already support zones, weights, stacking flags, alerts, metrics.

## MVP Constraint Proposal

### Hard Constraints

- Truck bounds: every placed item must fit inside length, width, and height.
- No 3D overlap: items cannot intersect in X/Y/Z space.
- Max payload: total product weight must not exceed truck `maxPayloadKg` when present.
- Required dimensions: automatic placement requires positive length, width, and height.
- Rotation permission: 90-degree rotation only when `rotationAllowed` permits it.
- Zone max weight: each truck zone must not exceed `maxWeightKg` when present.

### Soft Constraints

- Unloading order: earlier unloading destinations should be closer to the door.
- Weight balance: left/right and cabin/center/door concentration should be penalized.
- Volume usage: prefer placing more items and using available volume efficiently.
- Load compactness: prefer lower `loadLengthMm` when placement quality is otherwise similar.
- Manual stability MVP: avoid stacking in the first MVP; keep stackable as future scoring input.

## Approaches

1. **Constraint + scoring wrapper around current heuristic** — keep first-fit placement, add explicit constraint evaluation and a numeric score.
   - Pros: Smallest change, easy to test, creates measurable MVP foundation.
   - Cons: Does not search many alternatives yet.
   - Effort: Low

2. **Multi-candidate heuristic search** — generate several candidate orders/orientations/zone fallbacks and choose best score.
   - Pros: Real optimization improvement without ML.
   - Cons: More moving parts; needs scoring first anyway.
   - Effort: Medium

3. **RL/DRL planner** — train/serve an agent to place items.
   - Pros: Long-term experimentation path.
   - Cons: Requires stable environment, reward function, datasets/simulation, reproducibility; too early for MVP.
   - Effort: High

## Recommendation

Start with approach 1 as `planner-constraints-scoring-mvp`.

The deliverable should be a reusable evaluator that takes planner input/result and returns:
- hard constraint violations,
- soft penalties,
- a total score,
- alerts/metrics integration points.

For MVP, do not change the public flow: `generate()` still returns a plan. The internal planner becomes measurable and ready for multi-candidate optimization later.

Suggested scoring direction:
- Start from `1000`.
- Hard violations add critical alerts and make the plan non-approvable.
- Penalize unplaced items heavily.
- Penalize weight imbalance and zone overload.
- Reward placed item count and compact load length.

## Risks

- Over-designing constraints before operational feedback: keep thresholds simple and configurable in code constants first.
- Treating warnings as hard failures too early: for MVP, max payload/bounds/overlap/zone max are hard; balance remains warning/penalty.
- Stacking complexity can explode quickly: defer stacking search, but keep `stackable` visible for future requirements.

## Ready for Proposal

Yes. Next proposal should be `planner-constraints-scoring-mvp`: formalize hard/soft constraints and add a scoring/evaluation layer around the existing heuristic before trying multi-candidate search or RL.
