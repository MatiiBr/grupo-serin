import { CustomsReleaseStatus } from '@prisma/client';

export function customsReleaseAllowsLoading(release?: { status: CustomsReleaseStatus } | null) {
  return !release || release.status === CustomsReleaseStatus.CLEARED;
}

export function clearCustomsRelease() {
  return { status: CustomsReleaseStatus.CLEARED, blockedReason: null, clearedAt: new Date() };
}

export function blockCustomsRelease(blockedReason: string) {
  return { status: CustomsReleaseStatus.BLOCKED, blockedReason, clearedAt: null };
}
