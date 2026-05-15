# Proposal: Add Web Test Infrastructure

## Intent

Add runtime/component testing for the web app so frontend routing and UI refactors are verified beyond TypeScript compilation.

## Scope

### In Scope
- Add Vitest test script for `@camiones/web`.
- Add Testing Library and jsdom configuration.
- Add an initial router smoke test for existing web routes.
- Keep existing app behavior unchanged.

### Out of Scope
- E2E/browser automation.
- Full coverage for all frontend forms and planner interactions.
- Backend test changes.

## Capabilities

### New Capabilities
- `web-test-infrastructure`: Web runtime/component test setup and baseline expectations.

### Modified Capabilities
- None

## Approach

Use the existing repo test runner family by adding Vitest to the web workspace, configure jsdom, and write a focused route rendering test using Testing Library.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/package.json` | Modified | Add `test` script and dev dependencies. |
| `apps/web/vitest.config.ts` | New | Web Vitest/jsdom config. |
| `apps/web/src/test/setup.ts` | New | Testing Library setup. |
| `apps/web/src/App.test.tsx` | New | Baseline route smoke tests. |
| `openspec/config.yaml` | Modified | Update cached testing capabilities. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Three.js/jsdom incompatibility | Medium | Mock heavy route dependencies if needed; test routing shell only. |
| Slow tests | Low | Keep initial suite small. |

## Rollback Plan

Revert this change commit to remove web test dependencies/config/tests.

## Dependencies

- React Router structure already in place.

## Success Criteria

- [ ] `npm run test --workspace @camiones/web` exists and passes.
- [ ] Web test renders at least one app route through router/test providers.
- [ ] `npm run typecheck --workspace @camiones/web` passes.
