import {
  addProductToCart,
  calculateCartMoneyTotals,
  type CartItem,
  type ProductForCart,
} from './cart';

export interface ScanCartResult {
  cart: CartItem[];
  feedback: string;
  tone: 'success' | 'warning' | 'danger';
  increasedQuantity: boolean;
}

export const buildProductNotFoundMessage = (barcode: string): string => (
  `No product found for barcode ${barcode}`
);

export const addScannedProductToCart = (
  cart: CartItem[],
  product: ProductForCart
): ScanCartResult => {
  const alreadyInCart = cart.some((item) => item.id === product.barcode);
  const nextCart = addProductToCart(cart, product);
  return {
    cart: nextCart,
    feedback: alreadyInCart ? `Quantity increased: ${product.name}` : `Added: ${product.name}`,
    tone: 'success',
    increasedQuantity: alreadyInCart,
  };
};

export const validateCartForCheckout = (cart: CartItem[]): void => {
  if (cart.length === 0) {
    throw new Error('Add at least one product before checkout');
  }
  cart.forEach((item) => {
    if (item.quantity <= 0) {
      throw new Error(`${item.name} has an invalid quantity`);
    }
    if (item.availableStock !== undefined && item.quantity > item.availableStock) {
      throw new Error(`${item.name} has only ${item.availableStock} units available`);
    }
  });
};

export const canSubmitCheckout = (
  cart: CartItem[],
  submitting: boolean,
  billDiscount = 0,
  taxRate = 0
): boolean => {
  if (submitting || cart.length === 0) {
    return false;
  }
  const totals = calculateCartMoneyTotals(cart, billDiscount, taxRate);
  return totals.total > 0;
};
