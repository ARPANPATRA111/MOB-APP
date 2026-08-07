import { applyStockDelta } from '../domain/inventory';
import { getDatabase, type DbExecutor } from '../db/database';
import { createLocalId, nowIso, SYNC_STATUS_PENDING } from '../db/schema';

export interface StockMovementInput {
  productId: string;
  quantityDelta: number;
  movementType: 'initial' | 'adjustment' | 'sale' | 'restock' | 'legacy_import';
  reason?: string;
  referenceType?: string;
  referenceId?: string;
}

interface ProductStockRow {
  stock_quantity: number;
  name: string;
}

const dbOrDefault = async (db?: DbExecutor) => db ?? (await getDatabase());

export const getCurrentStock = async (
  productId: string,
  db?: DbExecutor
): Promise<number> => {
  const database = await dbOrDefault(db);
  const row = await database.getFirstAsync<ProductStockRow>(
    'SELECT stock_quantity, name FROM products WHERE id = ? AND deleted_at IS NULL',
    [productId]
  );
  if (!row) {
    throw new Error('Product not found');
  }

  return row.stock_quantity;
};

export const createStockMovement = async (
  input: StockMovementInput,
  db?: DbExecutor
): Promise<number> => {
  const database = await dbOrDefault(db);
  const row = await database.getFirstAsync<ProductStockRow>(
    'SELECT stock_quantity, name FROM products WHERE id = ? AND deleted_at IS NULL',
    [input.productId]
  );
  if (!row) {
    throw new Error('Product not found');
  }

  const stockAfter = applyStockDelta(row.stock_quantity, input.quantityDelta);
  const now = nowIso();

  await database.runAsync(
    `UPDATE products
      SET stock_quantity = ?, updated_at = ?, sync_status = ?, version = version + 1
      WHERE id = ?`,
    [stockAfter, now, SYNC_STATUS_PENDING, input.productId]
  );

  await database.runAsync(
    `INSERT INTO inventory_movements (
      id, product_id, movement_type, quantity_delta, stock_after, reason,
      reference_type, reference_id, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
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
      SYNC_STATUS_PENDING,
    ]
  );

  return stockAfter;
};

export const adjustStockWithReason = async (
  productId: string,
  nextQuantity: number,
  reason: string,
  db?: DbExecutor
): Promise<number> => {
  if (!reason.trim()) {
    throw new Error('Stock adjustment reason is required');
  }

  const currentStock = await getCurrentStock(productId, db);
  return createStockMovement(
    {
      productId,
      quantityDelta: nextQuantity - currentStock,
      movementType: 'adjustment',
      reason,
    },
    db
  );
};

export interface LowStockProduct {
  id: string;
  barcode: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
}

export const listLowStockProducts = async (db?: DbExecutor): Promise<LowStockProduct[]> => {
  const database = await dbOrDefault(db);
  const rows = await database.getAllAsync<{
    id: string;
    barcode: string;
    name: string;
    stock_quantity: number;
    low_stock_threshold: number;
  }>(
    `SELECT id, barcode, name, stock_quantity, low_stock_threshold
      FROM products
      WHERE deleted_at IS NULL AND stock_quantity <= low_stock_threshold
      ORDER BY stock_quantity ASC, name ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    quantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
  }));
};
