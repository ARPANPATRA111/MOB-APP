import { BACKUP_TABLES, validateBackupManifest, parseBackupTheme } from '../fullBackupManifest';

const manifest = () => ({
  format: 1,
  schemaVersion: 4,
  createdAt: new Date().toISOString(),
  databaseSha256: 'a'.repeat(64),
  counts: Object.fromEntries(BACKUP_TABLES.map((t) => [t, 0])),
  images: [
    { originalUri: 'file:///old/photo.jpg', entry: 'images/photo.jpg', sha256: 'b'.repeat(64) },
  ],
  theme: 'system',
});

it('accepts a complete backup inventory', () =>
  expect(validateBackupManifest(manifest(), 4).images).toHaveLength(1));

it('rejects traversal, duplicate images, missing tables and incompatible schemas', () => {
  expect(() => validateBackupManifest({ ...manifest(), schemaVersion: 99 }, 4)).toThrow();

  const bad = manifest();
  delete bad.counts.payments;
  expect(() => validateBackupManifest(bad, 4)).toThrow();

  expect(() =>
    validateBackupManifest(
      { ...manifest(), images: [{ ...manifest().images[0], entry: 'images/../../database.db' }] },
      4
    )
  ).toThrow();

  expect(() =>
    validateBackupManifest(
      { ...manifest(), images: [...manifest().images, ...manifest().images] },
      4
    )
  ).toThrow();
});

it('preserves JSON-encoded theme preferences and tolerates older plain strings', () => {
  expect(parseBackupTheme('"dark"')).toBe('dark');
  expect(parseBackupTheme('"light"')).toBe('light');
  expect(parseBackupTheme('dark')).toBe('dark');
  expect(parseBackupTheme(null)).toBe('system');
  expect(parseBackupTheme('{broken')).toBe('system');
});
