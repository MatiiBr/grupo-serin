# Design: Migrate Operation Form To React Hook Form

## Technical Approach

Install `react-hook-form`, use `useForm<OperationFormValues>()` in `OperationsPage`, and keep the existing mutation/API flow unchanged.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|-------------------------|-----------|
| Form library | `react-hook-form` | Continue `FormData` | User requested `useForm`; it reduces manual parsing as forms grow. |
| Scope | Migrate one form first | Migrate all forms at once | Keeps branch reviewable and establishes pattern safely. |
| Validation | No schema library yet | Add zod/yup now | Current fields are optional; schema belongs in a later validation-focused change. |

## Data Flow

    input register -> handleSubmit -> map values -> operationsApi.create mutation

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/package.json` | Modify | Add `react-hook-form`. |
| `OperationsPage.tsx` | Modify | Replace manual submit handler. |
| `App.test.tsx` | Modify | Add create operation form test. |

## Interfaces / Contracts

```ts
interface OperationFormValues {
  code?: string;
  name?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  notes?: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Web component | Submit payload mapping | Testing Library + mocked `operationsApi.create` |
| Typecheck | Form value types | `npm run typecheck --workspace @camiones/web` |
| Regression | API suite | `npm run test:api` |

## Migration / Rollout

No data migration required.

## Open Questions

- None
