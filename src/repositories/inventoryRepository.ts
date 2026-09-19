import { getDatabase, inTransaction, type DbExecutor } from '../db/database';
import { createLocalId, nowIso } from '../db/schema';
import { applyStockDelta } from '../domain/inventory';
import { validateQuantity } from '../domain/commerce';
export interface StockMovementInput {
  productId: string;
  quantityDelta: number;
  movementType: 'initial' | 'adjustment' | 'sale' | 'restock' | 'legacy_import';
  reason?: string;
  referenceType?: string;
  referenceId?: string;
}
export const getCurrentStock = async (productId: string, db?: DbExecutor) => {
  const row = await (db ?? (await getDatabase())).getFirstAsync<{ stock_quantity: number }>(
    'SELECT stock_quantity FROM products WHERE id = ? AND deleted_at IS NULL',
    [productId]
  );
  if (!row) throw new Error('Product not found');
  return row.stock_quantity;
};
export const createStockMovement = async (
  input: StockMovementInput,
  db?: DbExecutor
): Promise<number> =>
  inTransaction(async (txn) => {
    const row = await txn.getFirstAsync<{ stock_quantity: number; unit: string }>(
      'SELECT stock_quantity, unit FROM products WHERE id = ? AND deleted_at IS NULL',
      [input.productId]
    );
    if (!row) throw new Error('Product not found');
    const stockAfter = applyStockDelta(row.stock_quantity, input.quantityDelta);
    validateQuantity(stockAfter, row.unit ?? 'piece', true);
    const now = nowIso();
    await txn.runAsync(
      'UPDATE products SET stock_quantity = ?, updated_at = ?, sync_status = ?, version = version + 1 WHERE id = ?',
      [stockAfter, now, 'pending', input.productId]
    );
    await txn.runAsync(
      `INSERT INTO inventory_movements (id, product_id, movement_type, quantity_delta, stock_after, reason, reference_type, reference_id, created_at, updated_at, sync_status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)`,
      [
        createLocalId('movement'),
        input.productId,
        input.movementType,
        input.quantityDelta,
        stockAfter,
        input.reason ?? null,
        input.referenceType ?? null,
        input.referenceId ?? null,
        now,
        now,
      ]
    );
    return stockAfter;
  }, db);
export const adjustStockWithReason = async (
  productId: string,
  nextQuantity: number,
  reason: string,
  db?: DbExecutor
) =>
  inTransaction(async (txn) => {
    if (!reason.trim()) throw new Error('Stock adjustment reason is required');
    const current = await getCurrentStock(productId, txn);
    return createStockMovement(
      { productId, quantityDelta: nextQuantity - current, movementType: 'adjustment', reason },
      txn
    );
  }, db);
export interface LowStockProduct {
  id: string;
  barcode: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
}
export const listLowStockProducts = async (db?: DbExecutor): Promise<LowStockProduct[]> => {
  return (db ?? (await getDatabase())).getAllAsync<LowStockProduct>(
    'SELECT id, barcode, name, stock_quantity AS quantity, low_stock_threshold AS lowStockThreshold FROM products WHERE deleted_at IS NULL AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity, name'
  );
};
export const listStockHistory = async (productId?: string, db?: DbExecutor) =>
  (db ?? (await getDatabase())).getAllAsync<{
    id: string;
    product_name: string;
    quantity_delta: number;
    stock_after: number;
    movement_type: string;
    reason: string;
    created_at: string;
  }>(
    `SELECT m.*, p.name AS product_name FROM inventory_movements m JOIN products p ON p.id=m.product_id WHERE (? IS NULL OR m.product_id=?) ORDER BY m.created_at DESC LIMIT 100`,
    [productId ?? null, productId ?? null]
  );
