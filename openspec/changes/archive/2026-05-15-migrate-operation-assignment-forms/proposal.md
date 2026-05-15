# Proposal: Migrate Operation Assignment Forms

## Intent

Continue the `react-hook-form` migration by replacing manual `FormData` parsing in operation assignment forms: vehicle, destination, and product assignment.

## Scope

### In Scope
- Migrate `TruckPage`, `DestinationsPage`, and `ProductsPage` forms to `useForm`.
- Preserve existing payload mapping and default values.
- Remove obsolete assignment submit helpers from shared operation UI.
- Add/extend web tests for assignment payload mapping where practical.

### Out of Scope
- Lifecycle/order/dispatch form migration.
- Schema validation libraries.
- API contract or visual redesign changes.

## Capabilities

### New Capabilities
- `operation-assignment-form-handling`: Frontend form handling for operation vehicle, destination, and product assignments.

### Modified Capabilities
- None

## Approach

Use `useForm` locally in each page, keep native controls and labels unchanged, and map form values to existing API payloads on submit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `TruckPage.tsx` | Modified | Vehicle assignment form uses `useForm`. |
| `DestinationsPage.tsx` | Modified | Destination assignment form uses `useForm`. |
| `ProductsPage.tsx` | Modified | Product assignment form uses `useForm`. |
| `operation-ui.tsx` | Modified | Remove manual submit helpers no longer used. |
| `App.test.tsx` | Modified | Add focused assignment form coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Payload regression | Medium | Web tests assert representative payloads. |
| Scope creep | Medium | Keep lifecycle forms for later. |

## Rollback Plan

Revert the change commit to restore previous manual assignment forms.

## Dependencies

- `react-hook-form` installed by prior operation form migration.
- Web test infrastructure available.

## Success Criteria

- [ ] Assignment forms use `useForm` instead of manual `FormData` parsing.
- [ ] Payload mappings remain compatible.
- [ ] Web tests, web typecheck, and API tests pass.
