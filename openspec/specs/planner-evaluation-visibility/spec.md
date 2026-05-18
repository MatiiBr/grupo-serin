# Planner Evaluation Visibility Specification

## Purpose

Expose planner evaluation so users can understand plan quality before optimization work.

## Requirements

### Requirement: API Evaluation Summary

Loading plan API responses MUST include an evaluation summary when metrics are available.

#### Scenario: Evaluation summary from persisted data

- GIVEN a loading plan has metrics and alerts
- WHEN the API maps it to a DTO
- THEN the DTO SHALL include score, hard violation count, soft penalty total, and penalties.

### Requirement: Planner UI Evaluation Panel

The planner UI MUST display evaluation details when a plan has evaluation data.

#### Scenario: Score visible

- GIVEN a user opens a planner with evaluation data
- WHEN the plan detail renders
- THEN the score and hard violation count SHALL be visible.

#### Scenario: Penalties visible

- GIVEN the evaluation contains penalties
- WHEN the panel renders
- THEN penalty labels and point costs SHALL be visible.

### Requirement: Missing Evaluation Tolerance

The planner UI MUST remain usable if older responses do not include evaluation.

#### Scenario: No evaluation field

- GIVEN a loading plan response has no evaluation
- WHEN the plan detail renders
- THEN the existing planner view SHALL still render without errors.

### Requirement: Optional Candidate Diagnostics Visibility

Loading plan API responses MAY include candidate diagnostics when they are available from the generated planner result.

#### Scenario: Generated plan includes candidate diagnostics

- GIVEN a newly generated loading plan result includes candidate diagnostics
- WHEN the API maps the result to a response DTO
- THEN the DTO SHALL include winner metadata and candidate summaries.

#### Scenario: Persisted plan without diagnostics remains valid

- GIVEN an older or persisted loading plan has no candidate diagnostics
- WHEN the API maps it to a response DTO
- THEN the DTO SHALL omit candidate diagnostics and still include the evaluation summary when available.
