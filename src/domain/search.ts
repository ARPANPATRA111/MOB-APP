import type { InventoryItem } from '../types';

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export const normalizeSearch = (value: string): string => value.trim().toLowerCase();

export const fuzzyProductScore = (product: Pick<InventoryItem, 'name' | 'barcode' | 'category'>, query: string): number => {
  const normalized = normalizeSearch(query);
  if (!normalized) {
    return 1;
  }

  const name = product.name.toLowerCase();
  const barcode = product.barcode.toLowerCase();
  const category = product.category?.toLowerCase() ?? '';

  if (barcode === normalized || name === normalized) return 100;
  if (barcode.startsWith(normalized) || name.startsWith(normalized)) return 80;
  if (barcode.includes(normalized) || name.includes(normalized)) return 60;
  if (category.includes(normalized)) return 30;

  const initials = name.split(/\s+/).map((part) => part[0]).join('');
  return initials.includes(normalized) ? 20 : 0;
};

export const fuzzySearchProducts = (products: InventoryItem[], query: string): InventoryItem[] => {
  return products
    .map((product) => ({ product, score: fuzzyProductScore(product, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .map((entry) => entry.product);
};

export const paginate = <T,>(items: T[], { page, pageSize }: PaginationInput): T[] => {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  return items.slice((safePage - 1) * safePageSize, safePage * safePageSize);
};
