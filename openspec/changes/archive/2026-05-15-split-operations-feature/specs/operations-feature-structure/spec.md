# Operations Feature Structure Specification

## Purpose

Define source organization for the operations frontend feature so page, component, planner, report, and hook responsibilities are explicit.

## Requirements

### Requirement: Page Modules

The operations feature MUST expose route-level pages from dedicated page modules instead of a monolithic page parking file.

#### Scenario: Page ownership

- GIVEN a developer opens `features/operations/pages/`
- WHEN they inspect the folder
- THEN each route-level operation page SHALL have a dedicated page module.

#### Scenario: Removed parking file

- GIVEN the refactor is complete
- WHEN the operations feature files are listed
- THEN `OperationPages.tsx` SHALL NOT exist.

### Requirement: Shared Feature Components

Shared operation UI MUST live in feature component modules instead of route page files when reused by multiple pages.

#### Scenario: Operation chrome reuse

- GIVEN multiple operation pages render the same header/navigation or dashboard UI
- WHEN source files are inspected
- THEN that shared UI SHALL live under `features/operations/components/`.

### Requirement: Feature Hooks

Feature data hooks MUST live in feature hook modules instead of the route page implementation files.

#### Scenario: Operation data hook

- GIVEN a page needs operation detail data
- WHEN it imports the operation query hook
- THEN the hook SHALL come from `features/operations/hooks/`.

### Requirement: Behavioral Preservation

The refactor MUST preserve existing route-level exports and runtime behavior.

#### Scenario: Router imports

- GIVEN `App.tsx` imports operation pages
- WHEN TypeScript compiles the web workspace
- THEN the imports SHALL resolve without changing route paths.
