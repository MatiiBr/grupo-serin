# Planner Evaluation Visibility Delta Specification

## ADDED Requirements

### Requirement: Planner UI Candidate Diagnostics Panel

The planner UI MUST display candidate diagnostics when a loading plan response includes them.

#### Scenario: Winning candidate visible

- GIVEN a loading plan has candidate diagnostics
- WHEN the planner detail renders
- THEN the winning candidate name and index SHALL be visible.

#### Scenario: Candidate comparison visible

- GIVEN candidate diagnostics include candidate summaries
- WHEN the diagnostics panel renders
- THEN each candidate SHALL show name, score, hard violation count, placed item count, and unplaced item count.

#### Scenario: Missing diagnostics tolerated

- GIVEN a loading plan has no candidate diagnostics
- WHEN the planner detail renders
- THEN the existing planner view SHALL still render without a diagnostics panel.
