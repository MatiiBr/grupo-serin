# Planner Evaluation Visibility Delta Specification

## ADDED Requirements

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
