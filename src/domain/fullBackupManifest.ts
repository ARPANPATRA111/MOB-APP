export const BACKUP_FORMAT = 1;

/** Preferences use JSON storage; older draft archives sometimes stored a plain string. */
export const parseBackupTheme = (raw: string | null): 'light' | 'dark' | 'system' => {
  let value: unknown = raw;
  try {
    value = raw == null ? null : JSON.parse(raw);
  } catch {}
  return value === 'light' || value === 'dark' ? value : 'system';
};

export const BACKUP_TABLES = [
  'schema_migrations',
  'business_profiles',
  'operators',
  'categories',
  'products',
  'customers',
  'sales',
  'sale_items',
  'inventory_movements',
  'payments',
  'app_settings',
  'audit_logs',
  'backup_exports',
  'suppliers',
  'purchases',
  'purchase_items',
  'bill_drafts',
  'import_runs',
] as const;

export interface BackupManifest {
  format: number;

  schemaVersion: number;

  createdAt: string;

  databaseSha256: string;

  counts: Record<string, number>;

  images: { originalUri: string; entry: string; sha256: string }[];

  theme: 'light' | 'dark' | 'system';
}

export const validateBackupManifest = (value: unknown, schemaVersion: number): BackupManifest => {
  const m = value as BackupManifest;

  if (!m || m.format !== BACKUP_FORMAT || m.schemaVersion !== schemaVersion)
    throw new Error('This backup needs a matching version of MOPX. Update the app and try again.');

  if (!Number.isFinite(Date.parse(m.createdAt)) || !/^[a-f0-9]{64}$/.test(m.databaseSha256 ?? ''))
    throw new Error('Invalid backup manifest');

  if (
    !m.counts ||
    Object.keys(m.counts).length !== BACKUP_TABLES.length ||
    BACKUP_TABLES.some(
      (t) => !Number.isSafeInteger(m.counts[t]) || m.counts[t] < 0 || m.counts[t] > 5e6
    )
  )
    throw new Error('Invalid backup record counts');

  if (
    !['light', 'dark', 'system'].includes(m.theme) ||
    !Array.isArray(m.images) ||
    m.images.length > 50000
  )
    throw new Error('Invalid backup contents');

  const entries = new Set<string>();
  const originals = new Set<string>();

  for (const image of m.images) {
    if (
      !image ||
      typeof image.originalUri !== 'string' ||
      !image.originalUri.startsWith('file:') ||
      !/^images\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(image.entry) ||
      !/^[a-f0-9]{64}$/.test(image.sha256) ||
      entries.has(image.entry) ||
      originals.has(image.originalUri)
    )
      throw new Error('Invalid or duplicate backup image');

    entries.add(image.entry);
    originals.add(image.originalUri);
  }

  return m;
};
