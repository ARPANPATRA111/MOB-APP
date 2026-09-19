import type { DbExecutor } from '../../db/database';

import { adjustStockWithReason, createStockMovement } from '../inventoryRepository';

class InventoryFakeDb {
  withExclusiveTransactionAsync = async (task: (txn: DbExecutor) => Promise<void>) => {
    await task(this as unknown as DbExecutor);
  };

  stock = 10;

  movements: unknown[] = [];

  execAsync = jest.fn(async () => {});

  getAllAsync = jest.fn(async <T>() => [] as T[]);

  getFirstAsync = jest.fn(async <T>() => ({ stock_quantity: this.stock, name: 'Rice' }) as T);

  runAsync = jest.fn(async (sql: string, params?: any) => {
    if (sql.includes('UPDATE products')) {
      this.stock = Number(params?.[0]);
    }

    if (sql.includes('INSERT INTO inventory_movements')) {
      this.movements.push({ reason: params?.[5], stockAfter: params?.[4] });
    }

    return { lastInsertRowId: 0, changes: 1 };
  });
}

describe('inventory repository stock movements', () => {
  it('updates stock through a movement record', async () => {
    const db = new InventoryFakeDb();

    const stockAfter = await createStockMovement(
      {
        productId: 'product-1',

        quantityDelta: -3,

        movementType: 'sale',

        reason: 'Sale completed',
      },
      db as unknown as DbExecutor
    );

    expect(stockAfter).toBe(7);

    expect(db.stock).toBe(7);

    expect(db.movements).toHaveLength(1);
  });

  it('requires a reason for manual adjustment', async () => {
    const db = new InventoryFakeDb();

    await expect(
      adjustStockWithReason('product-1', 12, '', db as unknown as DbExecutor)
    ).rejects.toThrow('reason');
  });
});
