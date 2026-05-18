# Planner Multi-Candidate Search Delta Specification

## ADDED Requirements

### Requirement: Candidate Diagnostics

The planner MUST include compact diagnostics for evaluated candidates when multi-candidate search runs.

#### Scenario: Winning candidate is identifiable

- GIVEN the planner evaluates multiple candidates
- WHEN generation completes
- THEN the result SHALL identify the winning candidate index and name.

#### Scenario: Candidate scores are inspectable

- GIVEN the planner evaluates multiple candidates
- WHEN callers inspect candidate diagnostics
- THEN each candidate summary SHALL include candidate name, score, hard violation count, placed item count, and unplaced item count.

#### Scenario: Tie-breaking remains explainable

- GIVEN candidates have equal score and hard violation count
- WHEN the earlier candidate wins by tie-breaker
- THEN diagnostics SHALL preserve each candidate index so the stable winner is explainable.
