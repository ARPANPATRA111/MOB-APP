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

export const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
      `);
      return db;
    });
  }

  return databasePromise;
};

export const executeExclusive = async (
  db: DbExecutor,
  task: (txn: DbExecutor) => Promise<void>
): Promise<void> => {
  if (db.withExclusiveTransactionAsync) {
    await db.withExclusiveTransactionAsync(task);
    return;
  }

  await task(db);
};
