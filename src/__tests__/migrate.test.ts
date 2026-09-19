/* eslint-disable import/first */

import type { DbExecutor } from '../db/database';

jest.mock('../db/database', () => ({
  executeExclusive: jest.fn(async (db: DbExecutor, task: (txn: DbExecutor) => Promise<void>) => {
    if (db.withExclusiveTransactionAsync) {
      await db.withExclusiveTransactionAsync(task);

      return;
    }

    await task(db);
  }),

  getDatabase: jest.fn(),
}));

import { ensureMigrationTable, runMigrations } from '../db/migrate';

class MigrationFakeDb {
  migrations = new Set<string>();

  execAsync = jest.fn(async () => {});

  runAsync = jest.fn(async (_sql: string, params?: any) => {
    if (params?.[0]) {
      this.migrations.add(String(params[0]));
    }

    return { lastInsertRowId: 0, changes: 1 };
  });

  getFirstAsync = jest.fn(async () => null);

  getAllAsync = jest.fn(async <T>() => Array.from(this.migrations).map((id) => ({ id })) as T[]);

  withExclusiveTransactionAsync = async (task: (txn: DbExecutor) => Promise<void>) => {
    await task(this as unknown as DbExecutor);
  };
}

describe('migration runner', () => {
  it('creates migration metadata table', async () => {
    const db = new MigrationFakeDb();

    await ensureMigrationTable(db as unknown as DbExecutor);

    expect(db.execAsync).toHaveBeenCalledWith(expect.stringContaining('schema_migrations'));
  });

  it('applies migrations once and skips on second run', async () => {
    const db = new MigrationFakeDb();

    const first = await runMigrations(db as unknown as DbExecutor);

    const second = await runMigrations(db as unknown as DbExecutor);

    expect(first.applied).toEqual([
      '001_initial_schema',

      '002_sales_customer_phone',

      '003_performance_indexes',

      '004_commerce',
    ]);

    expect(second.applied).toEqual([]);

    expect(second.skipped).toEqual([
      '001_initial_schema',

      '002_sales_customer_phone',

      '003_performance_indexes',

      '004_commerce',
    ]);
  });
});
