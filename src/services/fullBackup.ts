import * as FileSystem from 'expo-file-system/legacy';

import * as SQLite from 'expo-sqlite';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDatabase, withDatabaseMaintenance } from '../db/database';

import { SCHEMA_VERSION } from '../db/migrate';

import { createLocalId, nowIso } from '../db/schema';

import {
  BACKUP_FORMAT,
  parseBackupTheme,
  BACKUP_TABLES,
  validateBackupManifest,
  type BackupManifest,
} from '../domain/fullBackupManifest';

import { restoreRecords, validateRestoreDatabase } from '../repositories/restoreRepository';

import { getSetting, setSetting } from '../repositories/settingsRepository';

import { billingSession } from './billingSession';

import { notifyDataChanged } from './dataEvents';

import { retailNative } from './retailNative';

const cache = () => {
  if (!FileSystem.cacheDirectory) throw new Error('App storage is unavailable');
  return FileSystem.cacheDirectory;
};

const documents = () => {
  if (!FileSystem.documentDirectory) throw new Error('App storage is unavailable');
  return FileSystem.documentDirectory;
};

const removeStaging = async (uri: string) => {
  if (!uri.startsWith(cache() + 'mopx-')) throw new Error('Invalid temporary path');

  await FileSystem.deleteAsync(uri, { idempotent: true });
};

const stageDatabase = (directory: string) =>
  SQLite.openDatabaseAsync('database.db', { useNewConnection: true }, directory);

export interface BackupStatus {
  createdAt?: string;
  fileUri?: string;
  safetyBackupUri?: string;
  reminderDays: number;
}

export const getBackupStatus = () =>
  getSetting<BackupStatus>('fullBackupStatus', { reminderDays: 0 });

export const createFullBackup = async (
  password: string
): Promise<{ uri: string; manifest: BackupManifest }> => {
  if (password.length < 10) throw new Error('Use a backup password of at least 10 characters');

  await billingSession.flush();

  const root = cache() + createLocalId('mopx-backup') + '/';
  const folder = documents() + 'backups/';

  await FileSystem.makeDirectoryAsync(root + 'images/', {
    intermediates: true,
  });
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });

  const output = folder + createLocalId('MOPX') + '.mopx';

  try {
    const manifest = await withDatabaseMaintenance(async (live) => {
      const snapshot = await stageDatabase(root);

      try {
        await SQLite.backupDatabaseAsync({
          sourceDatabase: live,
          destDatabase: snapshot,
        });

        const legacy = await AsyncStorage.multiGet([
          'inventory',
          'bills',
          'categories',
          'removedBarcodes',
        ]);

        const now = nowIso();
        const archivedLegacy = await getSetting<Record<string, string | null>>(
          'backupLegacySources',
          {},
          snapshot
        );
        const preservedLegacy = {
          ...archivedLegacy,
          ...Object.fromEntries(legacy.filter(([, value]) => value !== null)),
        };

        // Raw migration sources remain recoverable even when a legacy row could not be parsed.

        await snapshot.runAsync(
          `INSERT INTO app_settings(key,value,created_at,updated_at) VALUES('backupLegacySources',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
          [JSON.stringify(preservedLegacy), now, now]
        );

        const rows = await snapshot.getAllAsync<{ uri: string }>(
          `SELECT image_uri AS uri FROM products WHERE image_uri IS NOT NULL UNION SELECT logo_uri FROM business_profiles WHERE logo_uri IS NOT NULL UNION SELECT json_extract(seller_json,'$.logoUri') FROM sales WHERE json_valid(seller_json) UNION SELECT json_extract(j.value,'$.image') FROM bill_drafts d,json_each(d.payload_json,'$.cart') j WHERE json_valid(d.payload_json) UNION SELECT json_extract(value,'$.logoUri') FROM app_settings WHERE key='businessProfileExtras' AND json_valid(value)`
        );

        const images: BackupManifest['images'] = [];

        for (const { uri } of rows) {
          if (!uri) continue;

          if (!uri.startsWith(documents()) && !uri.startsWith(cache()))
            throw new Error(
              'A product photo is outside app storage. Re-select that photo before making a complete backup.'
            );

          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists)
            throw new Error(
              'A saved photo is missing. Update or remove that photo before making a complete backup.'
            );

          const suffix = /\.(png|webp)$/i.exec(uri)?.[1]?.toLowerCase() ?? 'jpg';
          const entry = `images/${createLocalId('image')}.${suffix}`;

          await FileSystem.copyAsync({ from: uri, to: root + entry });
          images.push({
            originalUri: uri,
            entry,
            sha256: await retailNative().sha256(root + entry),
          });
        }

        const counts: Record<string, number> = {};
        for (const table of BACKUP_TABLES)
          counts[table] = (await snapshot.getFirstAsync<{ n: number }>(
            `SELECT COUNT(*) AS n FROM ${table}`
          ))!.n;

        await snapshot.execAsync('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;');

        const theme = parseBackupTheme(await AsyncStorage.getItem('themePreference'));

        return {
          format: BACKUP_FORMAT,
          schemaVersion: SCHEMA_VERSION,
          createdAt: now,
          databaseSha256: '',
          counts,
          images,
          theme: theme === 'light' || theme === 'dark' ? theme : 'system',
        } as BackupManifest;
      } finally {
        await snapshot.closeAsync();
      }
    });

    manifest.databaseSha256 = await retailNative().sha256(root + 'database.db');
    validateBackupManifest(manifest, SCHEMA_VERSION);

    const manifestText = JSON.stringify(manifest);
    if (manifestText.length > 1000000)
      throw new Error('Too many image references for this backup format');

    await FileSystem.writeAsStringAsync(root + 'manifest.json', manifestText);

    await retailNative().packBackup(root, output, password);

    const status = await getBackupStatus();
    await setSetting('fullBackupStatus', {
      ...status,
      createdAt: manifest.createdAt,
      fileUri: output,
    });

    return { uri: output, manifest };
  } finally {
    await removeStaging(root);
  }
};

export interface PreparedRestore {
  encryptedUri: string;
  root: string;
  manifest: BackupManifest;
}

export const discardRestore = async (prepared: PreparedRestore) => removeStaging(prepared.root);

export const prepareRestore = async (uri: string, password: string): Promise<PreparedRestore> => {
  const root = cache() + createLocalId('mopx-restore') + '/';

  try {
    await retailNative().unpackBackup(uri, root, password);

    const manifest = validateBackupManifest(
      JSON.parse(await FileSystem.readAsStringAsync(root + 'manifest.json')),
      SCHEMA_VERSION
    );

    if ((await retailNative().sha256(root + 'database.db')) !== manifest.databaseSha256)
      throw new Error('Backup database checksum failed');

    for (const image of manifest.images)
      if ((await retailNative().sha256(root + image.entry)) !== image.sha256)
        throw new Error('Backup photo checksum failed');

    const source = await stageDatabase(root);

    try {
      await validateRestoreDatabase(source, await getDatabase(), manifest);
    } finally {
      await source.closeAsync();
    }

    return { root, manifest, encryptedUri: uri };
  } catch (error) {
    await removeStaging(root);
    throw error;
  }
};

export const applyFullRestore = async (
  prepared: PreparedRestore,
  password: string
): Promise<{ safetyBackupUri: string }> => {
  // Retain a complete encrypted copy of the current device before replacing records.

  const safety = await createFullBackup(password);
  const destination = documents() + 'product_images/' + createLocalId('restore') + '/';

  await FileSystem.makeDirectoryAsync(destination, { intermediates: true });
  const images = new Map<string, string>();

  for (const image of prepared.manifest.images) {
    const to = destination + image.entry.slice('images/'.length);
    await FileSystem.copyAsync({ from: prepared.root + image.entry, to });
    images.set(image.originalUri, to);
  }

  const restoredArchive = documents() + 'backups/' + createLocalId('MOPX-restored') + '.mopx';
  await FileSystem.copyAsync({
    from: prepared.encryptedUri,
    to: restoredArchive,
  });
  const source = await stageDatabase(prepared.root);

  try {
    await restoreRecords(source, await getDatabase(), prepared.manifest, images);
  } finally {
    await source.closeAsync();
  }

  billingSession.clear();

  // The database restore has committed. A preference write must not report data restoration as failed.

  await AsyncStorage.setItem('themePreference', JSON.stringify(prepared.manifest.theme)).catch(
    () => {}
  );

  await setSetting('fullBackupStatus', {
    ...(await getBackupStatus()),
    createdAt: prepared.manifest.createdAt,
    fileUri: restoredArchive,
    safetyBackupUri: safety.uri,
  }).catch(() => {});

  await import('./backupReminders').then((m) => m.restoreBackupReminder()).catch(() => {});
  await discardRestore(prepared).catch(() => {});
  notifyDataChanged();
  return { safetyBackupUri: safety.uri };
};
