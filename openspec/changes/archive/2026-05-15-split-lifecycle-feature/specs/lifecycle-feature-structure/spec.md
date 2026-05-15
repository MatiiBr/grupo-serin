# Lifecycle Feature Structure Specification

## Purpose

Define source organization for lifecycle, order, and dispatch web feature code.

## Requirements

### Requirement: Lifecycle Page Modules

The lifecycle feature MUST expose route-level pages from dedicated modules instead of one monolithic file.

#### Scenario: Page ownership

- GIVEN a developer opens `features/lifecycle/pages/`
- WHEN they inspect the folder
- THEN lifecycle, orders, and dispatch pages SHALL have dedicated page modules.

#### Scenario: Removed monolith

- GIVEN the refactor is complete
- WHEN lifecycle feature files are listed
- THEN `LifecyclePage.tsx` SHALL NOT exist.

### Requirement: Shared Lifecycle Components

Shared lifecycle lists and metrics MUST live in feature component modules.

#### Scenario: List ownership

- GIVEN order, demand, or dispatch lists are reused by pages
- WHEN source files are inspected
- THEN list components SHALL live under `features/lifecycle/components/`.

### Requirement: Lifecycle Hooks And Forms

Lifecycle mutation hooks and form submit helpers MUST be separated from route page modules.

#### Scenario: Hook and form ownership

- GIVEN a page needs status mutations or submit mapping
- WHEN it imports those functions
- THEN hooks SHALL come from `hooks/` and submit helpers SHALL come from `forms/`.

### Requirement: Behavioral Preservation

The refactor MUST preserve current route exports and runtime behavior.

#### Scenario: Router imports

- GIVEN `App.tsx` imports lifecycle pages
- WHEN the web workspace compiles and tests run
- THEN route imports SHALL resolve without path or behavior changes.
