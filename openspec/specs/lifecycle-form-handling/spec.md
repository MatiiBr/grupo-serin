# Lifecycle Form Handling Specification

## Purpose

Define `react-hook-form` handling for lifecycle customer and order intake forms.

## Requirements

### Requirement: Customer Form

The customer creation form MUST use `react-hook-form` and preserve payload mapping.

#### Scenario: Customer payload

- GIVEN a user fills code, name, tax id, and notes
- WHEN they submit the customer form
- THEN the create customer mutation SHALL receive trimmed code/name and optional tax id/notes.

### Requirement: Order Form

The order creation form MUST use `react-hook-form` and preserve item snapshot mapping.

#### Scenario: Order payload

- GIVEN a user selects customer, priority, product, quantity, destination, and delivery date
- WHEN they submit the order form
- THEN the create order mutation SHALL receive the existing order payload shape with one item.

#### Scenario: Product code fallback

- GIVEN product code snapshot is empty
- WHEN the order payload is created
- THEN item product code SHALL fall back to selected catalog product code.

### Requirement: Runtime Verification

Lifecycle form migration MUST include web runtime tests for customer and order submit mapping.

#### Scenario: Tested lifecycle submits

- GIVEN the web test suite runs
- WHEN lifecycle form tests execute
- THEN they SHALL verify create customer and create order payload mapping.
