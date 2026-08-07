/**
 * Integrity metadata + validation for full MOB backups (`.mobbackup` / JSON).
 *
 * A backup carries a manifest (format tag, app + schema version, timestamp,
 * row counts, checksum) so a restore can be validated and previewed before it
 * touches the database. The checksum is a deterministic FNV-1a hash over the
 * data payload so a corrupted or truncated file is detected.
 */

export interface BackupCounts {
  products: number;
  bills: number;
  categories: number;
}

export interface BackupManifest {
  format: 'mob-backup';
  appVersion: string;
  schemaVersion: number;
  latestMigrationId: string;
  exportedAt: string;
  counts: BackupCounts;
  checksum: string;
}

export interface ChecksumPayload {
  inventory: unknown[];
  bills: unknown[];
  categories: unknown[];
  removedBarcodes: unknown[];
}

/** Deterministic payload string; key order is fixed so build == validate. */
export const checksumPayload = (data: ChecksumPayload): string =>
  JSON.stringify({
    inventory: data.inventory,
    bills: data.bills,
    categories: data.categories,
    removedBarcodes: data.removedBarcodes,
  });

/** FNV-1a 32-bit hash → 8-char hex. Not cryptographic — corruption detection only. */
export const computeChecksum = (payload: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export interface BackupPreview {
  products: number;
  bills: number;
  categories: number;
  exportedAt: string;
  appVersion: string;
}

export interface BackupValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  preview?: BackupPreview;
}

/** Validate a parsed backup object before any restore is attempted. */
export const validateBackup = (parsed: unknown): BackupValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['This file is not a valid MOB backup.'], warnings };
  }

  const record = parsed as Record<string, unknown>;
  const manifest = record.manifest as Partial<BackupManifest> | undefined;

  if (!manifest || manifest.format !== 'mob-backup') {
    errors.push('Missing MOB backup manifest — this may be an old or unrelated file.');
  }

  const inventory = Array.isArray(record.inventory) ? (record.inventory as unknown[]) : null;
  const bills = Array.isArray(record.bills) ? (record.bills as unknown[]) : [];
  const categories = Array.isArray(record.categories) ? (record.categories as unknown[]) : [];
  const removedBarcodes = Array.isArray(record.removedBarcodes) ? (record.removedBarcodes as unknown[]) : [];

  if (!inventory) {
    errors.push('Backup is missing product data.');
  }

  if (manifest?.checksum) {
    const recomputed = computeChecksum(
      checksumPayload({ inventory: inventory ?? [], bills, categories, removedBarcodes })
    );
    if (recomputed !== manifest.checksum) {
      errors.push('Checksum mismatch — the backup file may be corrupted or edited.');
    }
  } else {
    warnings.push('Backup has no checksum; integrity cannot be verified.');
  }

  const preview: BackupPreview | undefined = manifest
    ? {
        products: manifest.counts?.products ?? inventory?.length ?? 0,
        bills: manifest.counts?.bills ?? bills.length,
        categories: manifest.counts?.categories ?? categories.length,
        exportedAt: manifest.exportedAt ?? String(record.createdAt ?? ''),
        appVersion: manifest.appVersion ?? 'unknown',
      }
    : undefined;

  return { valid: errors.length === 0, errors, warnings, preview };
};

export const buildManifest = (params: {
  appVersion: string;
  schemaVersion: number;
  latestMigrationId: string;
  data: ChecksumPayload;
}): BackupManifest => ({
  format: 'mob-backup',
  appVersion: params.appVersion,
  schemaVersion: params.schemaVersion,
  latestMigrationId: params.latestMigrationId,
  exportedAt: new Date().toISOString(),
  counts: {
    products: params.data.inventory.length,
    bills: params.data.bills.length,
    categories: params.data.categories.length,
  },
  checksum: computeChecksum(checksumPayload(params.data)),
});
