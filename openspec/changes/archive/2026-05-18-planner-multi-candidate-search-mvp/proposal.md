# Proposal: Planner Multi-Candidate Search MVP

## Problem

The current loading planner produces a single deterministic first-fit plan. The scoring model can identify a better or worse result, but generation does not use that score to choose among alternatives.

## Proposed Change

Add a small deterministic candidate-search layer inside the planner:

- Generate multiple product-unit orderings.
- Reuse the existing placement routine for each candidate.
- Evaluate each candidate with `LoadingPlanEvaluator`.
- Return the candidate with the best score using stable tie-breakers.

## Scope

Affected modules/packages:

- `@camiones/api` loading planner domain.
- OpenSpec planner specifications.

Out of scope:

- Random search.
- Reinforcement learning.
- New public API fields.
- New database fields or migrations.
- UI changes.

## Rollback Plan

Revert the candidate-search refactor and keep the previous single-ordering planner flow. No data migration is required.
