import fs from 'fs';
import path from 'path';
import { reviewProductsCsv } from '../domain/backup';
import { isChecksumValid, isInStoreCode } from '../domain/barcode';

/** The shipped sample file must always import cleanly on a fresh install. */
describe('docs/samples/MOPX-sample-products.csv', () => {
  const csv = fs.readFileSync(path.join(__dirname, '../../docs/samples/MOPX-sample-products.csv'), 'utf8');
  const review = reviewProductsCsv(csv);

  it('parses without errors or warnings', () => {
    expect(review.errors).toEqual([]);
    expect(review.warnings).toEqual([]);
    expect(review.rows.length).toBeGreaterThanOrEqual(60);
  });

  it('uses valid in-store EAN-13 codes so stickers can be printed and scanned', () => {
    for (const row of review.rows) {
      expect(isChecksumValid(row.barcode)).toBe(true);
      expect(isInStoreCode(row.barcode)).toBe(true);
    }
    expect(new Set(review.rows.map((r) => r.barcode)).size).toBe(review.rows.length);
  });

  it('keeps whole-number stock for piece, pack and box units', () => {
    for (const row of review.rows)
      if (['piece', 'pack', 'box'].includes(row.unit ?? 'piece')) expect(Number.isInteger(row.quantity)).toBe(true);
  });
});
