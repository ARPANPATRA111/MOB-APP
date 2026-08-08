import {
  addScannedProductToCart,
  buildProductNotFoundMessage,
  canSubmitCheckout,
  validateCartForCheckout,
} from '../scannerCart';
import type { CartItem, ProductForCart } from '../cart';

const rice: ProductForCart = {
  barcode: '8901001',
  name: 'Rice 1kg',
  price: 55,
  quantity: 3,
};

describe('scanner cart helpers', () => {
  it('adds a scanned product and increases quantity on repeat scans', () => {
    const first = addScannedProductToCart([], rice);
    expect(first.cart).toHaveLength(1);
    expect(first.cart[0].quantity).toBe(1);
    expect(first.increasedQuantity).toBe(false);

    const second = addScannedProductToCart(first.cart, rice);
    expect(second.cart[0].quantity).toBe(2);
    expect(second.increasedQuantity).toBe(true);
    expect(second.feedback).toContain('Quantity increased');
  });

  it('uses a clear not-found message for manual barcode fallback', () => {
    expect(buildProductNotFoundMessage('12345')).toBe('No product found for barcode 12345');
  });

  it('blocks checkout for empty, invalid, or over-stock carts', () => {
    expect(() => validateCartForCheckout([])).toThrow('Add at least one product');

    const invalidQuantity: CartItem[] = [{
      id: '1',
      name: 'Tea',
      price: 10,
      quantity: 0,
      total: 0,
      availableStock: 2,
    }];
    expect(() => validateCartForCheckout(invalidQuantity)).toThrow('invalid quantity');

    const overStock: CartItem[] = [{ ...invalidQuantity[0], quantity: 3, total: 30 }];
    expect(() => validateCartForCheckout(overStock)).toThrow('only 2 units');
  });

  it('allows checkout only when there is a payable cart and no active submit', () => {
    const cart: CartItem[] = [{
      id: rice.barcode,
      name: rice.name,
      price: rice.price,
      quantity: 1,
      total: rice.price,
      availableStock: rice.quantity,
      discount: 0,
    }];

    expect(canSubmitCheckout(cart, false)).toBe(true);
    expect(canSubmitCheckout(cart, true)).toBe(false);
    expect(canSubmitCheckout([], false)).toBe(false);
    expect(canSubmitCheckout(cart, false, 55)).toBe(false);
  });
});
