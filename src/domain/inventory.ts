import { validateQuantity } from './commerce';
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const assertCanDeductStock = (
  availableQuantity: number,
  requestedQuantity: number,
  productName = 'Product'
) => {
  validateQuantity(requestedQuantity);
  if (requestedQuantity > availableQuantity)
    throw new Error(`${productName} has only ${availableQuantity} units available`);
};
export const applyStockDelta = (currentQuantity: number, quantityDelta: number): number => {
  if (
    !Number.isFinite(quantityDelta) ||
    Math.abs(quantityDelta * 1000 - Math.round(quantityDelta * 1000)) > 0.00001
  )
    throw new Error('Invalid stock quantity');
  const nextQuantity = Math.round((currentQuantity + quantityDelta) * 1000) / 1000;
  if (nextQuantity < 0) throw new Error('Stock movement would create negative stock');
  return validateQuantity(nextQuantity, 'kg', true);
};
export const isLowStock = (quantity: number, threshold = DEFAULT_LOW_STOCK_THRESHOLD) =>
  quantity <= threshold;
