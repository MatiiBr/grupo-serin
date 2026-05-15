# Web Routing Specification

## Purpose

Define how the web app resolves URLs, renders pages, and navigates between logistics flows.

## Requirements

### Requirement: Declarative Route Rendering

The web app MUST render existing page flows through declarative route definitions while preserving current public paths.

#### Scenario: Operations index route

- GIVEN a user opens `/` or `/operations`
- WHEN the web app loads
- THEN the operations list and new operation form SHALL render.

#### Scenario: Operation child routes

- GIVEN an operation id exists in the URL
- WHEN the user opens `/operations/:operationId/truck`, `/destinations`, `/products`, `/planner`, or `/report`
- THEN the matching operation page SHALL render with the same operation id.

#### Scenario: Unknown route

- GIVEN a user opens an unsupported path
- WHEN the route is resolved
- THEN the app SHALL show the not-found empty state.

### Requirement: Router-Owned Navigation

Navigation controls MUST use router APIs instead of manual `window.history` and synthetic `popstate` events.

#### Scenario: Primary navigation

- GIVEN the app shell is visible
- WHEN the user chooses Carga, Lifecycle, Pedidos, or Dispatch
- THEN the router SHALL update the URL and render the selected page.

#### Scenario: Active operation navigation

- GIVEN the user is inside an operation route
- WHEN the operation header renders
- THEN the active nav item SHALL reflect the current child route.

### Requirement: Minimal Bootstrap Entrypoint

The React entrypoint MUST only initialize root providers and delegate application routing/rendering to app-level modules.

#### Scenario: Entrypoint responsibility

- GIVEN `main.tsx` is loaded
- WHEN React starts
- THEN it SHALL create the root, mount providers, and render the app component only.
