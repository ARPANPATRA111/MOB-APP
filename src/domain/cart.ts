import { calculateCartTotals } from './billing';

export interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  image?: string;
  availableStock?: number;
  discount?: number;
}

export interface ProductForCart {
  barcode: string;
  name: string;
  price: number;
  quantity: number;
  imageUri?: string;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

const roundMoney = (value: number) => Number(value.toFixed(2));

export const addProductToCart = (items: CartItem[], product: ProductForCart): CartItem[] => {
  if (product.quantity <= 0) {
    throw new Error(`${product.name} is out of stock`);
  }

  const existing = items.find((item) => item.id === product.barcode);
  if (!existing) {
    return [
      ...items,
      {
        id: product.barcode,
        name: product.name,
        quantity: 1,
        price: product.price,
        total: roundMoney(product.price),
        image: product.imageUri,
        availableStock: product.quantity,
        discount: 0,
      },
    ];
  }

  return updateCartQuantity(items, product.barcode, existing.quantity + 1, product.quantity);
};

export const updateCartQuantity = (
  items: CartItem[],
  id: string,
  quantity: number,
  availableStock?: number
): CartItem[] => {
  if (!Number.isInteger(quantity)) {
    throw new Error('Quantity must be a whole number');
  }

  if (quantity <= 0) {
    return removeCartItem(items, id);
  }

  const item = items.find((entry) => entry.id === id);
  if (!item) {
    throw new Error('Cart item not found');
  }

  const stock = availableStock ?? item.availableStock;
  if (stock !== undefined && quantity > stock) {
    throw new Error(`Only ${stock} units available`);
  }

  return items.map((entry) =>
    entry.id === id
      ? {
          ...entry,
          quantity,
          availableStock: stock,
          total: roundMoney(quantity * entry.price - (entry.discount ?? 0)),
        }
      : entry
  );
};

export const updateCartItemDiscount = (
  items: CartItem[],
  id: string,
  discount: number
): CartItem[] => {
  if (!Number.isFinite(discount) || discount < 0) {
    throw new Error('Discount must be a non-negative amount');
  }

  return items.map((item) => {
    if (item.id !== id) {
      return item;
    }

    const gross = item.quantity * item.price;
    if (discount > gross) {
      throw new Error('Item discount cannot exceed item subtotal');
    }

    return {
      ...item,
      discount,
      total: roundMoney(gross - discount),
    };
  });
};

export const removeCartItem = (items: CartItem[], id: string): CartItem[] => {
  return items.filter((item) => item.id !== id);
};

export const calculateCartMoneyTotals = (
  items: CartItem[],
  billDiscount = 0,
  taxRate = 0
): CartTotals => {
  const totals = calculateCartTotals(
    items.map((item) => ({
      productId: item.id,
      barcode: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: Math.round(item.price * 100),
      availableStock: item.availableStock ?? item.quantity,
      discountCents: Math.round((item.discount ?? 0) * 100),
    })),
    Math.round(billDiscount * 100),
    taxRate
  );

  return {
    subtotal: roundMoney(totals.subtotalCents / 100),
    discount: roundMoney(totals.discountCents / 100),
    tax: roundMoney(totals.taxCents / 100),
    total: roundMoney(totals.totalCents / 100),
  };
};
