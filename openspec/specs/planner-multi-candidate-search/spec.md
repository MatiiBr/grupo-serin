# Planner Multi-Candidate Search Specification

## Purpose

Define deterministic multi-candidate search for the loading planner MVP.

## Requirements

### Requirement: Candidate Generation

The planner MUST generate more than one deterministic candidate ordering for eligible product units.

#### Scenario: Multiple candidates evaluated

- GIVEN a loading planner input with multiple product units
- WHEN generation runs
- THEN the planner SHALL evaluate at least the current ordering and one alternate ordering.

### Requirement: Best Score Selection

The planner MUST return the candidate with the best evaluation score.

#### Scenario: Better scored candidate wins

- GIVEN an alternate candidate places more items or has fewer penalties than the current ordering
- WHEN candidates are evaluated
- THEN the returned result SHALL be the alternate candidate with the higher score.

### Requirement: Stable Tie-Breaking

The planner MUST remain deterministic when candidate scores tie.

#### Scenario: Equal score keeps stable result

- GIVEN two candidates have the same score and hard violation count
- WHEN selecting the result
- THEN the planner SHALL prefer the earlier candidate order.

### Requirement: Existing Behavior Compatibility

Multi-candidate search MUST preserve existing API output shape and existing valid planner scenarios.

#### Scenario: Existing tests remain valid

- GIVEN existing planner tests
- WHEN multi-candidate generation is enabled
- THEN those tests SHALL continue to pass.
