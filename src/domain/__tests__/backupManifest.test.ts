import {
  buildManifest,
  checksumPayload,
  computeChecksum,
  validateBackup,
} from '../backupManifest';

const sampleData = {
  inventory: [{ barcode: '4006381333931', name: 'Tea', quantity: 5, price: 10 }],
  bills: [{ id: 'BILL-1', total: 10 }],
  categories: ['Grocery'],
  removedBarcodes: [],
};

describe('backup checksum', () => {
  it('is deterministic for the same payload', () => {
    const a = computeChecksum(checksumPayload(sampleData));
    const b = computeChecksum(checksumPayload({ ...sampleData }));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes when data changes', () => {
    const a = computeChecksum(checksumPayload(sampleData));
    const b = computeChecksum(
      checksumPayload({ ...sampleData, inventory: [{ barcode: 'x', name: 'Y', quantity: 1, price: 1 }] })
    );
    expect(a).not.toBe(b);
  });
});

describe('validateBackup', () => {
  const goodBackup = () => ({
    manifest: buildManifest({
      appVersion: '2.0.0',
      schemaVersion: 3,
      latestMigrationId: '003_performance_indexes',
      data: sampleData,
    }),
    ...sampleData,
  });

  it('accepts a well-formed backup and returns a preview', () => {
    const result = validateBackup(goodBackup());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.preview?.products).toBe(1);
    expect(result.preview?.bills).toBe(1);
    expect(result.preview?.appVersion).toBe('2.0.0');
  });

  it('rejects a non-object / unrelated file', () => {
    expect(validateBackup(null).valid).toBe(false);
    expect(validateBackup('nope').valid).toBe(false);
  });

  it('flags a missing manifest', () => {
    const result = validateBackup({ ...sampleData });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/manifest/i);
  });

  it('detects a corrupted payload via checksum mismatch', () => {
    const backup = goodBackup();
    backup.inventory = [{ barcode: 'tampered', name: 'Z', quantity: 99, price: 99 }];
    const result = validateBackup(backup);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/checksum/i);
  });

  it('warns when there is no checksum but still previews', () => {
    const backup = goodBackup();
    delete (backup.manifest as { checksum?: string }).checksum;
    const result = validateBackup(backup);
    expect(result.warnings.join(' ')).toMatch(/checksum/i);
  });
});
