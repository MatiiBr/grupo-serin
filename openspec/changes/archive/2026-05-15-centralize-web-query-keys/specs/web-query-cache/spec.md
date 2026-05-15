# Web Query Cache Specification

## Purpose

Define how web React Query cache keys are named and reused.

## Requirements

### Requirement: Central Key Builders

The web app MUST define React Query cache keys through a shared `queryKeys` module.

#### Scenario: Query key lookup

- GIVEN a page or hook needs a React Query key
- WHEN it declares `useQuery` or invalidates queries
- THEN it SHALL use `queryKeys` instead of an inline array literal.

#### Scenario: Key value preservation

- GIVEN an existing cache key such as `['operation', operationId]`
- WHEN it is migrated to `queryKeys`
- THEN the resulting tuple SHALL keep the same segment values and order.

### Requirement: Feature Coverage

The shared query key module MUST cover current operations, lifecycle, catalog, dispatch, loading plan, and report keys used by web features.

#### Scenario: Existing web feature queries

- GIVEN current web features compile
- WHEN inline keys are migrated
- THEN every existing query and invalidation SHALL have a corresponding `queryKeys` entry.

### Requirement: Behavioral Preservation

The migration MUST NOT change query functions, mutation functions, route behavior, or API payloads.

#### Scenario: Typecheck verification

- GIVEN the migration is complete
- WHEN the web workspace is typechecked
- THEN TypeScript SHALL compile without query key type errors.
