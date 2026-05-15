# Proposal: Migrate Operation Form To React Hook Form

## Intent

Start replacing manual `FormData` handling with `react-hook-form`, beginning with the `Nueva operacion` form. This establishes the pattern before migrating more complex forms.

## Scope

### In Scope
- Add `react-hook-form` to the web workspace.
- Migrate only the `Nueva operacion` form.
- Preserve current payload behavior, including date/time composition into `scheduledAt`.
- Add a web test for operation creation form submission.

### Out of Scope
- Migrating product, destination, order, or dispatch forms.
- Adding schema validation libraries.
- Changing API contracts.

## Capabilities

### New Capabilities
- `operation-form-handling`: Frontend form handling rules for operation creation.

### Modified Capabilities
- None

## Approach

Use `useForm` in `OperationsPage`, keep uncontrolled native inputs registered by field name, and map form values into the existing `CreateOperationPayload` shape on submit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/package.json` | Modified | Add `react-hook-form`. |
| `apps/web/src/features/operations/pages/OperationsPage.tsx` | Modified | Replace manual `FormData` submit. |
| `apps/web/src/App.test.tsx` | Modified | Cover create operation submit behavior. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Payload regression | Medium | Test submit payload, including date/time. |
| Over-patterning | Low | Limit to one form; no schema library yet. |

## Rollback Plan

Revert this change commit to restore manual form handling.

## Dependencies

- Web test infrastructure.

## Success Criteria

- [ ] `Nueva operacion` uses `useForm`.
- [ ] The submitted payload matches current behavior.
- [ ] Web tests, web typecheck, and API tests pass.
