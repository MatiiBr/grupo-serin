import { CustomsReleaseStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { blockCustomsRelease, clearCustomsRelease, customsReleaseAllowsLoading } from './customs-release-lifecycle';

describe('customs release lifecycle', () => {
  it('allows loading when no customs checkpoint is required', () => {
    expect(customsReleaseAllowsLoading(null)).toBe(true);
  });

  it('blocks loading until a required customs checkpoint is cleared', () => {
    expect(customsReleaseAllowsLoading({ status: CustomsReleaseStatus.PENDING })).toBe(false);
    expect(customsReleaseAllowsLoading({ status: CustomsReleaseStatus.BLOCKED })).toBe(false);
    expect(customsReleaseAllowsLoading({ status: CustomsReleaseStatus.CLEARED })).toBe(true);
  });

  it('normalizes clear and block transitions', () => {
    expect(clearCustomsRelease()).toMatchObject({ status: CustomsReleaseStatus.CLEARED, blockedReason: null });
    expect(blockCustomsRelease('Documentación incompleta')).toEqual({ status: CustomsReleaseStatus.BLOCKED, blockedReason: 'Documentación incompleta', clearedAt: null });
  });
});
