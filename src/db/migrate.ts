import { executeExclusive, getDatabase, type DbExecutor } from './database';
import { initialSchemaMigration } from './migrations/001_initial_schema';
import { salesCustomerPhoneMigration } from './migrations/002_sales_customer_phone';
import { performanceIndexesMigration } from './migrations/003_performance_indexes';
import { nowIso } from './schema';

export interface Migration {
  id: string;
  name: string;
  up: (db: DbExecutor) => Promise<void>;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

const migrations: Migration[] = [
  initialSchemaMigration,
  salesCustomerPhoneMigration,
  performanceIndexesMigration,
];

/** Number of migrations = numeric schema version. */
export const SCHEMA_VERSION = migrations.length;
/** Id of the most recent migration (shown in Settings / embedded in backups). */
export const LATEST_MIGRATION_ID = migrations[migrations.length - 1].id;

let migrationPromise: Promise<MigrationResult> | null = null;

export const ensureMigrationTable = async (db: DbExecutor): Promise<void> => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
};

export const runMigrations = async (dbOverride?: DbExecutor): Promise<MigrationResult> => {
  if (!dbOverride && migrationPromise) {
    return migrationPromise;
  }

  const run = async (): Promise<MigrationResult> => {
    const db = dbOverride ?? (await getDatabase());
    await ensureMigrationTable(db);

    const appliedRows = await db.getAllAsync<{ id: string }>('SELECT id FROM schema_migrations');
    const appliedIds = new Set(appliedRows.map((row) => row.id));
    const result: MigrationResult = { applied: [], skipped: [] };

    for (const migration of migrations) {
      if (appliedIds.has(migration.id)) {
        result.skipped.push(migration.id);
        continue;
      }

      await executeExclusive(db, async (txn) => {
        await migration.up(txn);
        await txn.runAsync(
          'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
          [migration.id, migration.name, nowIso()]
        );
      });
      result.applied.push(migration.id);
    }

    return result;
  };

  if (dbOverride) {
    return run();
  }

  migrationPromise = run();
  return migrationPromise;
};
