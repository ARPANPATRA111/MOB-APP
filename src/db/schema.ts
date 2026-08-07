export const SYNC_STATUS_PENDING = 'pending';
export const SYNC_STATUS_SYNCED = 'synced';

export const nowIso = () => new Date().toISOString();

export const safeIdPart = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return normalized.replace(/^-+|-+$/g, '') || 'item';
};

export const createLocalId = (prefix: string): string => {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
};

export const createStableLegacyId = (prefix: string, source: string): string => {
  return `${prefix}-${safeIdPart(source)}`;
};
