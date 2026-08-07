import type { DbExecutor } from '../db/database';

type ProductState = {
  id: string;
  barcode: string;
  name: string;
  price_cents: number;
  stock_quantity: number;
};

let state: {
  products: ProductState[];
  sales: unknown[];
  saleItems: unknown[];
  payments: unknown[];
  movements: unknown[];
};

class SaleFakeDb {
  execAsync = jest.fn(async () => {});
  getAllAsync = jest.fn(async <T>() => [] as T[]);
  getFirstAsync = jest.fn(async <T>(sql: string, params?: any) => {
    if (sql.includes('FROM products')) {
      const productId = params?.[1];
      const barcode = params?.[3];
      return (state.products.find(
        (product) => product.id === productId || product.barcode === barcode
      ) as T | undefined) ?? null;
    }
    return null;
  });
  runAsync = jest.fn(async (sql: string, params?: any) => {
    if (sql.includes('INSERT INTO sales')) {
      state.sales.push({ id: params?.[0] });
    }
    if (sql.includes('INSERT INTO sale_items')) {
      state.saleItems.push({ id: params?.[0] });
    }
    if (sql.includes('INSERT INTO payments')) {
      state.payments.push({ id: params?.[0] });
    }
    if (sql.includes('INSERT INTO inventory_movements')) {
      state.movements.push({ id: params?.[0] });
    }
    if (sql.includes('UPDATE products')) {
      const stockAfter = Number(params?.[0]);
      const productId = String(params?.[3]);
      const product = state.products.find((item) => item.id === productId);
      if (product) {
        product.stock_quantity = stockAfter;
      }
    }
    return { lastInsertRowId: 0, changes: 1 };
  });
  withExclusiveTransactionAsync = async (task: (txn: DbExecutor) => Promise<void>) => {
    const snapshot = JSON.parse(JSON.stringify(state));
    try {
      await task(this as unknown as DbExecutor);
    } catch (error) {
      state = snapshot;
      throw error;
    }
  };
}

const mockFakeDb = new SaleFakeDb();

jest.mock('../db/database', () => ({
  getDatabase: jest.fn(async () => mockFakeDb as unknown as DbExecutor),
  executeExclusive: jest.fn(async (db: DbExecutor, task: (txn: DbExecutor) => Promise<void>) => {
    await db.withExclusiveTransactionAsync?.(task);
  }),
}));

// eslint-disable-next-line import/first
import { createSaleTransaction } from '../repositories/saleRepository';

beforeEach(() => {
  jest.clearAllMocks();
  state = {
    products: [
      {
        id: 'product-1',
        barcode: '111',
        name: 'Rice',
        price_cents: 5000,
        stock_quantity: 3,
      },
    ],
    sales: [],
    saleItems: [],
    payments: [],
    movements: [],
  };
});

describe('sale repository transaction', () => {
  it('creates sale, payment, movement, and deducts stock atomically', async () => {
    const sale = await createSaleTransaction({
      id: 'sale-1',
      saleNumber: 'sale-1',
      paymentMethod: 'Cash',
      items: [{ barcode: '111', quantity: 2 }],
      payments: [{ method: 'Cash', amountCents: 10000 }],
    });

    expect(sale.totalCents).toBe(10000);
    expect(state.products[0].stock_quantity).toBe(1);
    expect(state.sales).toHaveLength(1);
    expect(state.saleItems).toHaveLength(1);
    expect(state.payments).toHaveLength(1);
    expect(state.movements).toHaveLength(1);
  });

  it('rolls back when stock is insufficient', async () => {
    await expect(
      createSaleTransaction({
        id: 'sale-2',
        saleNumber: 'sale-2',
        paymentMethod: 'Cash',
        items: [{ barcode: '111', quantity: 4 }],
        payments: [{ method: 'Cash', amountCents: 20000 }],
      })
    ).rejects.toThrow('Rice has only 3 units available');

    expect(state.products[0].stock_quantity).toBe(3);
    expect(state.sales).toHaveLength(0);
    expect(state.saleItems).toHaveLength(0);
    expect(state.payments).toHaveLength(0);
    expect(state.movements).toHaveLength(0);
  });
});
