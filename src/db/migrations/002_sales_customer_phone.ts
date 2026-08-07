import type { DbExecutor } from '../database';

export const salesCustomerPhoneMigration = {
  id: '002_sales_customer_phone',
  name: 'Add customer phone to sales',
  up: async (db: DbExecutor) => {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sales)');
    const hasCustomerPhone = columns.some((column) => column.name === 'customer_phone');
    if (!hasCustomerPhone) {
      await db.execAsync('ALTER TABLE sales ADD COLUMN customer_phone TEXT;');
    }
  },
};
