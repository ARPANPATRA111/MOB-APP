import { calculateCartTotals, validateCart } from '../domain/billing';
import { applyStockDelta, isLowStock } from '../domain/inventory';
import { calculateTotals, fromCents, toCents } from '../domain/money';
import { validateProductInput } from '../domain/validation';

describe('money domain', () => {
  it('converts money to cents and back', () => {
    expect(toCents(12.345)).toBe(1235);
    expect(fromCents(1235)).toBe(12.35);
  });

  it('calculates totals with discount and tax', () => {
    expect(
      calculateTotals(
        [
          { quantity: 2, unitPriceCents: 1000 },
          { quantity: 1, unitPriceCents: 500 },
        ],
        250,
        0.1
      )
    ).toEqual({
      subtotalCents: 2500,
      discountCents: 250,
      taxCents: 225,
      totalCents: 2475,
    });
  });
});

describe('validation domain', () => {
  it('rejects invalid product input', () => {
    const result = validateProductInput({
      barcode: '',
      name: '',
      quantity: '0',
      price: '-1',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Barcode is required');
    expect(result.errors).toContain('Product name is required');
  });
});

describe('inventory domain', () => {
  it('prevents negative stock movements', () => {
    expect(() => applyStockDelta(2, -3)).toThrow('negative stock');
  });

  it('detects low stock', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });
});

describe('billing domain', () => {
  const cart = [
    {
      productId: 'product-1',
      barcode: '111',
      name: 'Rice',
      quantity: 2,
      unitPriceCents: 1000,
      availableStock: 5,
    },
  ];

  it('calculates cart totals', () => {
    expect(calculateCartTotals(cart).totalCents).toBe(2000);
  });

  it('rejects duplicate cart products', () => {
    expect(() => validateCart([...cart, ...cart])).toThrow('Duplicate product');
  });

  it('rejects carts that exceed stock', () => {
    expect(() =>
      validateCart([{ ...cart[0], quantity: 6 }])
    ).toThrow('Rice has only 5 units available');
  });
});
