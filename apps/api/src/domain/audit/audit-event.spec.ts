import { describe, expect, it } from 'vitest';
import { normalizeAuditActor } from './audit-event';

describe('audit event', () => {
  it('uses a system actor until auth is available', () => {
    expect(normalizeAuditActor()).toBe('system');
    expect(normalizeAuditActor('   ')).toBe('system');
  });

  it('preserves explicit request actors for traceability', () => {
    expect(normalizeAuditActor('planner@example.com')).toBe('planner@example.com');
  });
});
