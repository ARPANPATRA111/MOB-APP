import type { DbExecutor } from '../database';
const addColumn = async (db: DbExecutor, table: string, name: string, definition: string) => {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some((column) => column.name === name))
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
};
export const commerceMigration = {
  id: '004_commerce',
  name: 'Durable checkout, purchases, costs and credit',
  up: async (db: DbExecutor) => {
    await addColumn(db, 'products', 'unit', "TEXT NOT NULL DEFAULT 'piece'");
    await addColumn(db, 'products', 'cost_cents', 'INTEGER');
    await addColumn(db, 'sales', 'currency_code', "TEXT NOT NULL DEFAULT 'INR'");
    await addColumn(db, 'sales', 'seller_json', 'TEXT');
    await addColumn(db, 'sales', 'due_date', 'INTEGER');
    await addColumn(db, 'sales', 'change_cents', 'INTEGER NOT NULL DEFAULT 0');
    await addColumn(db, 'sale_items', 'unit', "TEXT NOT NULL DEFAULT 'piece'");
    await addColumn(db, 'sale_items', 'unit_cost_cents', 'INTEGER');
    await addColumn(db, 'sale_items', 'cost_total_cents', 'INTEGER');
    await addColumn(db, 'sale_items', 'net_cents', 'INTEGER');
    await addColumn(db, 'payments', 'paid_at', 'INTEGER');
    await addColumn(db, 'payments', 'tendered_cents', 'INTEGER');
    await db.execAsync(`
      UPDATE sale_items SET net_cents = total_cents WHERE net_cents IS NULL;
      UPDATE payments SET paid_at = (SELECT sale_date FROM sales WHERE sales.id = payments.sale_id) WHERE paid_at IS NULL;
      UPDATE payments SET tendered_cents = amount_cents WHERE tendered_cents IS NULL;
      UPDATE sales SET currency_code = COALESCE((SELECT currency_code FROM business_profiles ORDER BY created_at LIMIT 1), 'INR');
      CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS purchases (id TEXT PRIMARY KEY, supplier_id TEXT REFERENCES suppliers(id), supplier_name TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', purchase_date INTEGER NOT NULL, total_cents INTEGER NOT NULL CHECK(total_cents >= 0), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS purchase_items (id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL REFERENCES purchases(id), product_id TEXT NOT NULL REFERENCES products(id), product_name TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity > 0), unit TEXT NOT NULL, unit_cost_cents INTEGER NOT NULL CHECK(unit_cost_cents >= 0), total_cents INTEGER NOT NULL CHECK(total_cents >= 0));
      CREATE TABLE IF NOT EXISTS bill_drafts (id TEXT PRIMARY KEY, label TEXT NOT NULL DEFAULT '', payload_json TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS import_runs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, rows_count INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(name COLLATE NOCASE, id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_sales_active_date ON sales(sale_date DESC, id DESC) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id, sale_date DESC);
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(paid_at);
      CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date DESC);
      CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_drafts_updated ON bill_drafts(updated_at DESC);
      CREATE TRIGGER IF NOT EXISTS stock_nonnegative_insert BEFORE INSERT ON products WHEN NEW.stock_quantity < 0 OR NEW.price_cents < 0 OR NEW.low_stock_threshold < 0 BEGIN SELECT RAISE(ABORT, 'Invalid product amount'); END;
      CREATE TRIGGER IF NOT EXISTS stock_nonnegative_update BEFORE UPDATE ON products WHEN NEW.stock_quantity < 0 OR NEW.price_cents < 0 OR NEW.low_stock_threshold < 0 BEGIN SELECT RAISE(ABORT, 'Invalid product amount'); END;
    `);
  },
};
