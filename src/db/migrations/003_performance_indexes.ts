import type { DbExecutor } from '../database';

/**
 * Additive performance indexes for hot query paths identified in the audit:
 * - payments looked up / cascaded by sale_id had no index.
 * - nearly every read filters `deleted_at IS NULL`; indexing it helps the
 *   planner skip soft-deleted rows.
 * - sales are filtered by status; inventory movements are queried by date.
 *
 * All are `IF NOT EXISTS` and additive, so the migration is idempotent and
 * safe to run against existing shop databases.
 */
export const performanceIndexesMigration = {
  id: '003_performance_indexes',
  name: 'Add missing performance indexes',
  up: async (db: DbExecutor) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
      CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
    `);
  },
};
