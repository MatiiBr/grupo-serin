# Planner Adjustment Form Handling Specification

## Purpose

Define form handling for manual placed-item adjustment payloads in the planner.

## Requirements

### Requirement: Adjustment Form Mapping

The planner adjustment form MUST use `react-hook-form` and preserve payload mapping.

#### Scenario: Numeric adjustment payload

- GIVEN a selected placed item with X, Y, Z, and rotation inputs
- WHEN the user submits the adjustment form
- THEN the payload SHALL include integer `xMm`, `yMm`, `zMm`, and `rotationDeg` values.

#### Scenario: Locked checkbox payload

- GIVEN the locked checkbox is checked or unchecked
- WHEN the user submits the adjustment form
- THEN the payload SHALL include `locked` as a boolean matching the checkbox state.

### Requirement: Manual FormData Removal

Web production code MUST NOT keep manual `new FormData` submit parsing after this migration.

#### Scenario: No manual parser remains

- GIVEN the planner form migration is complete
- WHEN web source is searched for `new FormData`
- THEN no production file SHALL contain a manual submit parser.

### Requirement: Runtime Verification

Planner form migration MUST include a focused web test for adjustment payload mapping.

#### Scenario: Tested adjustment mapping

- GIVEN the web test suite runs
- WHEN planner adjustment mapping tests execute
- THEN they SHALL verify numeric parsing and locked boolean behavior.
