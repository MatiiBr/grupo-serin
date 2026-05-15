# Operation Assignment Form Handling Specification

## Purpose

Define `react-hook-form` handling for operation assignment forms.

## Requirements

### Requirement: Vehicle Assignment Form

The vehicle assignment form MUST use `react-hook-form` and preserve its payload mapping.

#### Scenario: Vehicle payload

- GIVEN a user selects truck, optional trailer, and notes
- WHEN they submit the vehicle form
- THEN the mutation SHALL receive `truckCatalogId`, nullable `trailerCatalogId`, and optional notes.

### Requirement: Destination Assignment Form

The destination assignment form MUST use `react-hook-form` and preserve automatic unloading order behavior.

#### Scenario: Destination payload

- GIVEN a user selects a destination and notes
- WHEN they submit the destination form
- THEN the mutation SHALL receive destination id and notes, while page logic SHALL add the next unloading order.

### Requirement: Product Assignment Form

The product assignment form MUST use `react-hook-form` and preserve numeric and boolean override mapping.

#### Scenario: Product payload

- GIVEN a user submits product, quantity, overrides, checkboxes, and notes
- WHEN the product form is submitted
- THEN the mutation SHALL receive numeric values as numbers and checked overrides as `true`.

### Requirement: Runtime Verification

At least one operation assignment form MUST have runtime web test coverage for submit mapping in this change.

#### Scenario: Tested assignment submit

- GIVEN the web test suite runs
- WHEN assignment form tests execute
- THEN they SHALL verify mutation payload mapping for migrated forms.
