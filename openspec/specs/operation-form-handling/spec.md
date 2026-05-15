# Operation Form Handling Specification

## Purpose

Define how the web operation creation form is handled and verified.

## Requirements

### Requirement: React Hook Form Operation Creation

The `Nueva operacion` form MUST use `react-hook-form` instead of manual `FormData` parsing.

#### Scenario: Operation form submits payload

- GIVEN a user fills code, name, date, time, and notes
- WHEN they submit the form
- THEN the form SHALL call the create operation mutation with code, name, notes, and ISO `scheduledAt`.

#### Scenario: Optional scheduled date

- GIVEN a user submits the form without a date
- WHEN the payload is created
- THEN `scheduledAt` SHALL be omitted.

### Requirement: Existing UX Preservation

The migration MUST preserve the current visible fields and submit affordance.

#### Scenario: Visible controls

- GIVEN the operations route is rendered
- WHEN the creation form is inspected
- THEN Codigo, Nombre, Fecha, Hora, Notas, and Crear operacion controls SHALL remain visible.

### Requirement: Runtime Test Coverage

The operation creation form MUST have a web runtime test covering successful submission mapping.

#### Scenario: Tested submit mapping

- GIVEN the web test suite runs
- WHEN the operation form test executes
- THEN it SHALL verify the create API receives the expected payload.
