# Proposal: Migrate Planner Form

## Intent

Remove the last manual web `FormData` submit path by migrating the planner item adjustment form to `react-hook-form`.

## Scope

### In Scope
- Migrate the selected placed-item adjustment form in `planner-ui.tsx`.
- Preserve numeric payload mapping and locked checkbox behavior.
- Add a focused runtime/unit test for adjustment payload mapping.
- Remove dead shared form helpers if no web code uses them.

### Out of Scope
- Planner UX redesign.
- 3D scene behavior changes.
- API contract changes.

## Capabilities

### New Capabilities
- `planner-adjustment-form-handling`: Form handling for manual placed-item adjustment payloads.

### Modified Capabilities
- None

## Approach

Use `react-hook-form` in `SelectedItemPanel`, keep the payload mapper small and testable, and delete obsolete `lib/forms.ts` only if no imports remain.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/planner-ui.tsx` | Modified | Replace `FormData` submit handling. |
| `src/lib/forms.ts` | Removed | Delete if unused. |
| `planner-ui.test.tsx` | New | Verify adjustment payload mapping. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Manual adjustment payload regression | Medium | Test numeric and checkbox mapping. |
| 3D component test fragility | Low | Test pure mapper rather than Canvas rendering. |

## Rollback Plan

Revert this change commit to restore the previous planner adjustment submit path.

## Dependencies

- Existing `react-hook-form` dependency.
- Existing web Vitest setup.

## Success Criteria

- [x] Planner adjustment form uses `useForm`.
- [x] No web production code uses `new FormData`.
- [x] Obsolete shared form helpers are removed if unused.
- [x] Web tests, web typecheck, and API tests pass.
