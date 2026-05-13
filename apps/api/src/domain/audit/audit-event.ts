const SYSTEM_ACTOR = 'system';

export function normalizeAuditActor(actor?: string | null) {
  const normalized = actor?.trim();
  return normalized && normalized.length > 0 ? normalized : SYSTEM_ACTOR;
}
