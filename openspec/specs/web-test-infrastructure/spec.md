# Web Test Infrastructure Specification

## Purpose

Define baseline runtime/component testing for the web workspace.

## Requirements

### Requirement: Web Test Command

The web workspace MUST expose a test command that runs component/runtime tests without building the app.

#### Scenario: Web tests run

- GIVEN the developer runs `npm run test --workspace @camiones/web`
- WHEN tests execute
- THEN Vitest SHALL run the web test suite successfully.

### Requirement: DOM Component Environment

Web tests MUST run in a DOM-capable environment suitable for React components.

#### Scenario: React route render

- GIVEN a test renders the app with router and query providers
- WHEN the `/operations` route is loaded
- THEN the operations page heading SHALL be visible.

### Requirement: Existing Verification Compatibility

Adding web tests MUST NOT break existing typecheck or API tests.

#### Scenario: Existing checks still pass

- GIVEN web test infrastructure is installed
- WHEN web typecheck and API tests run
- THEN both SHALL pass.
