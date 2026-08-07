import type { InventoryItem } from '../types';

export const productsToCsv = (products: InventoryItem[]): string => {
  const header = ['barcode', 'name', 'quantity', 'price', 'category', 'imageUri'];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = products.map((product) => [
    product.barcode,
    product.name,
    product.quantity,
    product.price,
    product.category ?? '',
    product.imageUri ?? '',
  ].map(escape).join(','));
  return [header.join(','), ...rows].join('\n');
};

export const csvToProducts = (csv: string): InventoryItem[] => {
  const lines = csv.trim().split(/\r?\n/);
  const [, ...rows] = lines;
  return rows.flatMap((row) => {
    const columns = row.match(/("([^"]|"")*"|[^,]+)/g)?.map((value) =>
      value.replace(/^"|"$/g, '').replace(/""/g, '"')
    ) ?? [];
    if (columns.length < 4) {
      return [];
    }
    const quantity = Number(columns[2]);
    const price = Number(columns[3]);
    if (!columns[0] || !columns[1] || !Number.isFinite(quantity) || !Number.isFinite(price)) {
      return [];
    }
    return [{
      barcode: columns[0],
      name: columns[1],
      quantity,
      price,
      category: columns[4] || undefined,
      imageUri: columns[5] || undefined,
    }];
  });
};
