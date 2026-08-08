import type { CartItem } from '../domain/cart';

let currentCart: CartItem[] = [];

export const billingSession = {
  setCart: (cart: CartItem[]) => {
    currentCart = cart.map((item) => ({ ...item }));
  },
  getCart: () => currentCart.map((item) => ({ ...item })),
  clear: () => {
    currentCart = [];
  },
  hasCart: () => currentCart.length > 0,
};
