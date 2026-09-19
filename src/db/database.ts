import * as SQLite from 'expo-sqlite';
import type { SQLiteBindParams, SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';
export const DATABASE_NAME = 'moppos.db';
export interface DbExecutor {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SQLiteBindParams): Promise<SQLiteRunResult>;
  getFirstAsync<T>(source: string, params?: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params?: SQLiteBindParams): Promise<T[]>;
  withExclusiveTransactionAsync?: (task: (txn: DbExecutor) => Promise<void>) => Promise<void>;
}
let databasePromise: Promise<SQLiteDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
const transactions = new WeakSet<object>();
/** Serializes file snapshots with writes, without opening a destination transaction. */
export const withDatabaseMaintenance = async <T>(
  task: (db: SQLiteDatabase) => Promise<T>
): Promise<T> => {
  const run = writeQueue.then(async () => task(await getDatabase()));
  writeQueue = run.then(
    () => {},
    () => {}
  );
  return run;
};
export const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (!databasePromise)
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async (db) => {
        await db.execAsync(
          'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;'
        );
        // Initialize each transaction connection before BEGIN, including foreign keys.
        if ('closeAsync' in db)
          db.withExclusiveTransactionAsync = async (task) => {
            const txn = await SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
            try {
              await txn.execAsync(
                'PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE;'
              );
              try {
                await task(txn);
                await txn.execAsync('COMMIT;');
              } catch (error) {
                await txn.execAsync('ROLLBACK;');
                throw error;
              }
            } finally {
              await txn.closeAsync();
            }
          };
        return db;
      })
      .catch((error) => {
        databasePromise = null;
        throw error;
      });
  return databasePromise;
};
export const executeExclusive = async (
  db: DbExecutor,
  task: (txn: DbExecutor) => Promise<void>
): Promise<void> => {
  if (transactions.has(db)) {
    await task(db);
    return;
  }
  if (!db.withExclusiveTransactionAsync)
    throw new Error('A transaction is required for this operation');
  const run = writeQueue.then(() =>
    db.withExclusiveTransactionAsync!(async (txn) => {
      transactions.add(txn);
      try {
        await task(txn);
      } finally {
        transactions.delete(txn);
      }
    })
  );
  writeQueue = run.catch(() => {});
  await run;
};
export const inTransaction = async <T>(
  task: (txn: DbExecutor) => Promise<T>,
  override?: DbExecutor
): Promise<T> => {
  let value!: T;
  await executeExclusive(override ?? (await getDatabase()), async (txn) => {
    value = await task(txn);
  });
  return value;
};
