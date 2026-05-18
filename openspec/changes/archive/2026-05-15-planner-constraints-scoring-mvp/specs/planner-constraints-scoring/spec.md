# Planner Constraints Scoring Specification

## Purpose

Define MVP constraint and score evaluation for generated loading plans.

## Requirements

### Requirement: Hard Constraint Evaluation

The planner MUST evaluate generated plans against MVP hard constraints.

#### Scenario: Zone max weight violation

- GIVEN a truck zone has `maxWeightKg`
- WHEN placed item weight in that zone exceeds the limit
- THEN the generated result SHALL include a critical alert.

#### Scenario: Existing hard failures remain critical

- GIVEN an item is unplaced or total payload exceeds truck max payload
- WHEN the plan is evaluated
- THEN the result SHALL keep critical alerts for those failures.

### Requirement: Soft Constraint Scoring

The planner MUST produce an inspectable numeric score using soft penalties and placement rewards.

#### Scenario: Valid placed plan gets positive score

- GIVEN a generated plan places all items with no critical alerts
- WHEN scoring runs
- THEN score SHALL be positive and penalties SHALL be inspectable.

#### Scenario: Warning conditions reduce score

- GIVEN a generated plan has weight imbalance warnings
- WHEN scoring runs
- THEN score SHALL be lower than an otherwise comparable balanced plan.

### Requirement: Existing Placement Preservation

The evaluator MUST NOT change the current first-fit placement behavior in this MVP.

#### Scenario: Current heuristic tests remain valid

- GIVEN existing heuristic placement scenarios
- WHEN planner generation runs
- THEN placed/unplaced outcomes SHALL remain compatible with existing tests.

### Requirement: Future Optimization Foundation

Planner evaluation details SHOULD be returned from domain results so later multi-candidate search or RL can reuse the same reward semantics.

#### Scenario: Evaluation details available

- GIVEN a generated result
- WHEN callers inspect it
- THEN they SHALL be able to read total score, hard violation count, and soft penalty entries.
