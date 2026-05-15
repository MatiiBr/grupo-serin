# Proposal: Migrate Lifecycle Forms

## Intent

Finish the current form-handling cleanup by migrating lifecycle order intake forms from manual `FormData` helpers to `react-hook-form`.

## Scope

### In Scope
- Migrate `Alta cliente` form to `useForm`.
- Migrate `Nuevo pedido` form to `useForm`.
- Preserve existing payload mapping, defaults, and mutation invalidations.
- Add web runtime tests for customer and order submit mapping.

### Out of Scope
- Dispatch list action buttons; they are not forms.
- Schema validation libraries.
- Visual redesign or API changes.

## Capabilities

### New Capabilities
- `lifecycle-form-handling`: Frontend form handling for customer and order intake forms.

### Modified Capabilities
- None

## Approach

Use page-local `useForm` instances in `OrdersPage`, remove obsolete submit helpers from `forms/lifecycleForms.ts`, and assert representative payloads in web tests.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `pages/OrdersPage.tsx` | Modified | Customer/order forms use `useForm`. |
| `forms/lifecycleForms.ts` | Removed/Modified | Manual helpers removed if unused. |
| `App.test.tsx` | Modified | Add customer/order submit payload tests. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Payload regression | Medium | Runtime tests assert customer and order payloads. |
| Scope drift | Low | Keep dispatch list actions unchanged. |

## Rollback Plan

Revert this change commit to restore manual lifecycle form helpers.

## Dependencies

- Lifecycle feature split.
- Existing web test infrastructure.

## Success Criteria

- [x] Customer and order forms use `useForm`.
- [x] Manual lifecycle form helpers are removed or no longer used.
- [x] Web tests, web typecheck, and API tests pass.
