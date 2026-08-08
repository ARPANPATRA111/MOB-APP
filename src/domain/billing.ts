import { assertCanDeductStock } from './inventory';
import { calculateTotals, MoneyTotals } from './money';

export interface CartLine {
  productId: string;
  barcode: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  availableStock: number;
  discountCents?: number;
}

export const validateCart = (items: CartLine[]): void => {
  if (items.length === 0) {
    throw new Error('Cart must contain at least one item');
  }

  const seenProducts = new Set<string>();
  for (const item of items) {
    if (seenProducts.has(item.productId)) {
      throw new Error(`Duplicate product in cart: ${item.name}`);
    }

    seenProducts.add(item.productId);
    assertCanDeductStock(item.availableStock, item.quantity, item.name);

    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) {
      throw new Error(`Invalid price for ${item.name}`);
    }
  }
};

export const calculateCartTotals = (
  items: CartLine[],
  billDiscountCents = 0,
  taxRate = 0
): MoneyTotals => {
  validateCart(items);

  return calculateTotals(
    items.map((item) => ({
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      discountCents: item.discountCents ?? 0,
    })),
    billDiscountCents,
    taxRate
  );
};
