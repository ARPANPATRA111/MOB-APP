import type { InventoryItem } from '../types';
import { PRODUCT_UNITS, validateQuantity } from './commerce';
import { toCents } from './money';
const header = [
  'barcode',
  'name',
  'quantity',
  'price',
  'category',
  'unit',
  'costPrice',
  'lowStockThreshold',
];
const unsafe = /^[\s]*[=+\-@＝＋－＠\t\r]/;
export const productsToCsv = (products: InventoryItem[]): string => {
  const escape = (v: unknown) => {
    let s = String(v ?? '');
    if (unsafe.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [
    header.join(','),
    ...products.map((p) =>
      [
        p.barcode,
        p.name,
        p.quantity,
        p.price,
        p.category ?? '',
        p.unit ?? 'piece',
        p.costPrice ?? '',
        p.lowStockThreshold ?? 5,
      ]
        .map(escape)
        .join(',')
    ),
  ].join('\r\n');
};
export interface CsvReview {
  rows: InventoryItem[];
  errors: { row: number; message: string }[];
  warnings: string[];
}
export const parseCsv = (csv: string): string[][] => {
  if (csv.length > 10 * 1024 * 1024) throw new Error('CSV exceeds the 10 MB import limit');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const finish = () => {
    row.push(field);
    field = '';
    closed = false;
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw new Error('Unexpected quote in CSV');
      quoted = true;
    } else if (c === ',') finish();
    else if (c === '\n' || c === '\r') {
      finish();
      if (row.some((v) => v.length)) rows.push(row);
      row = [];
      if (c === '\r' && csv[i + 1] === '\n') i++;
    } else {
      if (closed && c !== ' ') throw new Error('Unexpected characters after closing quote');
      if (!closed) field += c;
    }
    if (rows.length > 10000) throw new Error('Import at most 10,000 products per file');
  }
  if (quoted) throw new Error('CSV contains an unclosed quote');
  finish();
  if (row.some((v) => v.length)) rows.push(row);
  return rows;
};
export const reviewProductsCsv = (csv: string): CsvReview => {
  const result: CsvReview = { rows: [], errors: [], warnings: [] };
  let records: string[][];
  try {
    records = parseCsv(csv.replace(/^\uFEFF/, ''));
  } catch (error) {
    return { ...result, errors: [{ row: 1, message: (error as Error).message }] };
  }
  const columns = records.shift()?.map((s) => s.trim()) ?? [];
  if (
    ['barcode', 'name', 'quantity', 'price'].some((c) => !columns.includes(c)) ||
    new Set(columns).size !== columns.length
  )
    return {
      ...result,
      errors: [{ row: 1, message: 'Required unique headers: barcode,name,quantity,price' }],
    };
  const codes = new Set<string>();
  records.forEach((record, index) => {
    try {
      if (record.length !== columns.length) throw new Error('Column count does not match header');
      const read = (name: string) => {
        const raw = record[columns.indexOf(name)] ?? '';
        return raw.startsWith("'") && unsafe.test(raw.slice(1)) ? raw.slice(1) : raw;
      };
      const barcode = read('barcode').trim();
      const name = read('name').trim();
      const unit = read('unit') || 'piece';
      if (
        !barcode ||
        barcode.length > 128 ||
        /[\x00-\x1f]/.test(barcode) ||
        !name ||
        name.length > 200
      )
        throw new Error('Invalid code or product name');
      if (codes.has(barcode)) throw new Error('Duplicate barcode in this file');
      codes.add(barcode);
      if (!PRODUCT_UNITS.includes(unit as never)) throw new Error('Unsupported unit');
      if (!read('quantity').trim() || !read('price').trim())
        throw new Error('Quantity and price are required');
      const quantity = validateQuantity(Number(read('quantity')), unit, true);
      const price = toCents(read('price')) / 100;
      if (price < 0) throw new Error('Price cannot be negative');
      const costPrice = read('costPrice').trim() ? toCents(read('costPrice')) / 100 : null;
      if (costPrice !== null && costPrice < 0) throw new Error('Cost cannot be negative');
      const lowStockThreshold = read('lowStockThreshold').trim()
        ? validateQuantity(Number(read('lowStockThreshold')), 'kg', true)
        : 5;
      result.rows.push({
        barcode,
        name,
        quantity,
        price,
        unit,
        costPrice,
        lowStockThreshold,
        category: read('category') || undefined,
      });
    } catch (error) {
      result.errors.push({ row: index + 2, message: (error as Error).message });
    }
  });
  if (!records.length) result.errors.push({ row: 2, message: 'No product rows found' });
  if (columns.includes('imageUri'))
    result.warnings.push('Image paths are ignored. Use a full backup to transfer photos.');
  return result;
};
export const csvToProducts = (csv: string): InventoryItem[] => reviewProductsCsv(csv).rows;
