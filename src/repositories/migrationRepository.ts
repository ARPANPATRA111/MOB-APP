import { getDatabase, type DbExecutor } from '../db/database';
import { createLocalId, nowIso } from '../db/schema';
import { getSetting, setSetting } from './settingsRepository';

export const LEGACY_MIGRATION_SETTING_KEY = 'legacy_async_storage_migration_complete';

const dbOrDefault = async (db?: DbExecutor) => db ?? (await getDatabase());

export const isLegacyMigrationComplete = async (db?: DbExecutor): Promise<boolean> => {
  return getSetting<boolean>(LEGACY_MIGRATION_SETTING_KEY, false, db);
};

export const markLegacyMigrationComplete = async (
  result: unknown,
  db?: DbExecutor
): Promise<void> => {
  await setSetting(LEGACY_MIGRATION_SETTING_KEY, true, db);
  await setSetting('legacy_async_storage_migration_result', result, db);
};

export const recordBackupSnapshot = async (
  snapshot: unknown,
  db?: DbExecutor
): Promise<string> => {
  const database = await dbOrDefault(db);
  const id = createLocalId('backup');
  const now = nowIso();
  await database.runAsync(
    `INSERT INTO backup_exports (
      id, backup_type, snapshot_json, created_at, completed_at, status
    ) VALUES (?, 'legacy_async_storage_pre_migration', ?, ?, ?, 'completed')`,
    [id, JSON.stringify(snapshot), now, now]
  );
  return id;
};

export const recordMigrationAudit = async (
  action: string,
  message: string,
  metadata: unknown,
  db?: DbExecutor
): Promise<void> => {
  const database = await dbOrDefault(db);
  await database.runAsync(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, message, metadata_json, created_at)
      VALUES (?, 'migration', NULL, ?, ?, ?, ?)`,
    [createLocalId('audit'), action, message, JSON.stringify(metadata), nowIso()]
  );
};
