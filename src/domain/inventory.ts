export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export const assertCanDeductStock = (
  availableQuantity: number,
  requestedQuantity: number,
  productName = 'Product'
) => {
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error('Requested quantity must be a positive integer');
  }

  if (requestedQuantity > availableQuantity) {
    throw new Error(`${productName} has only ${availableQuantity} units available`);
  }
};

export const applyStockDelta = (currentQuantity: number, quantityDelta: number): number => {
  const nextQuantity = currentQuantity + quantityDelta;
  if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
    throw new Error('Stock movement would create negative stock');
  }

  return nextQuantity;
};

export const isLowStock = (
  quantity: number,
  threshold = DEFAULT_LOW_STOCK_THRESHOLD
): boolean => {
  return quantity <= threshold;
};
