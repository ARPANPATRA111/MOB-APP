import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Bill, InventoryItem } from '../types';

import { runMigrations } from '../db/migrate';

import { getDatabase, executeExclusive } from '../db/database';

import { listCategories, replaceCategoriesByName } from '../repositories/categoryRepository';

import {
  recordBackupSnapshot,
  recordMigrationAudit,
  isLegacyMigrationComplete,
  markLegacyMigrationComplete,
} from '../repositories/migrationRepository';

import { upsertInventoryItem } from '../repositories/productRepository';

import { importLegacySale } from '../repositories/saleRepository';

import { setSetting } from '../repositories/settingsRepository';

export const LEGACY_STORAGE_KEYS = {
  inventory: 'inventory',

  bills: 'bills',

  categories: 'categories',

  removedBarcodes: 'removedBarcodes',

  themePreference: 'themePreference',
} as const;

export interface LegacyPayload {
  inventory: InventoryItem[];

  bills: Bill[];

  categories: string[];

  removedBarcodes: string[];

  themePreference: 'light' | 'dark' | null;
}

export interface LegacyMigrationResult {
  skipped: boolean;

  backupId?: string;

  importedProducts: number;

  importedBills: number;

  importedCategories: number;

  errors: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const safeParseJson = <T>(raw: string | null, fallback: T, key: string, errors: string[]): T => {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    errors.push(`Legacy key "${key}" contains invalid JSON: ${(error as Error).message}`);

    return fallback;
  }
};

export const normalizeLegacyInventory = (
  value: unknown,

  errors: string[] = []
): InventoryItem[] => {
  if (!Array.isArray(value)) {
    errors.push('Legacy inventory payload is not an array');

    return [];
  }

  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`Legacy inventory row ${index} is not an object`);

      return [];
    }

    const barcode = String(entry.barcode ?? '').trim();

    const name = String(entry.name ?? '').trim();

    const quantity = Number(entry.quantity);

    const price = Number(entry.price);

    if (
      !barcode ||
      !name ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      errors.push(`Legacy inventory row ${index} is invalid and was skipped`);

      return [];
    }

    return [
      {
        barcode,

        name,

        quantity,

        price,

        category: typeof entry.category === 'string' ? entry.category : undefined,

        imageUri: typeof entry.imageUri === 'string' ? entry.imageUri : undefined,
      },
    ];
  });
};

export const normalizeLegacyBills = (value: unknown, errors: string[] = []): Bill[] => {
  if (!Array.isArray(value)) {
    errors.push('Legacy bills payload is not an array');

    return [];
  }

  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`Legacy bill row ${index} is not an object`);

      return [];
    }

    const id = String(entry.id ?? '').trim();

    const total = Number(entry.total);

    const timestamp = Number(entry.timestamp);

    const items = Array.isArray(entry.items) ? entry.items : [];

    if (!id || !Number.isFinite(total) || !Number.isFinite(timestamp) || items.length === 0) {
      errors.push(`Legacy bill row ${index} is invalid and was skipped`);

      return [];
    }

    const normalizedItems = items.flatMap((item, itemIndex) => {
      if (!isRecord(item)) {
        errors.push(`Legacy bill ${id} item ${itemIndex} is not an object`);

        return [];
      }

      const itemId = String(item.id ?? '').trim();

      const name = String(item.name ?? '').trim();

      const quantity = Number(item.quantity);

      const price = Number(item.price);

      const lineTotal = Number(item.total);

      if (
        !itemId ||
        !name ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        !Number.isFinite(lineTotal)
      ) {
        errors.push(`Legacy bill ${id} item ${itemIndex} is invalid and was skipped`);

        return [];
      }

      return [
        {
          id: itemId,

          name,

          quantity,

          price,

          total: lineTotal,

          image: typeof item.image === 'string' ? item.image : undefined,
        },
      ];
    });

    if (normalizedItems.length === 0) {
      errors.push(`Legacy bill row ${index} has no valid items and was skipped`);

      return [];
    }

    return [
      {
        id,

        items: normalizedItems,

        total,

        customerName: typeof entry.customerName === 'string' ? entry.customerName : '',
        customerPhone: typeof entry.customerPhone === 'string' ? entry.customerPhone : undefined,
        timestamp,

        paymentMethod: typeof entry.paymentMethod === 'string' ? entry.paymentMethod : 'Cash',
      },
    ];
  });
};

export const readLegacyPayload = async (): Promise<{
  payload: LegacyPayload;
  errors: string[];
}> => {
  const errors: string[] = [];

  const [inventoryRaw, billsRaw, categoriesRaw, removedBarcodesRaw, themeRaw] = await Promise.all([
    AsyncStorage.getItem(LEGACY_STORAGE_KEYS.inventory),

    AsyncStorage.getItem(LEGACY_STORAGE_KEYS.bills),

    AsyncStorage.getItem(LEGACY_STORAGE_KEYS.categories),

    AsyncStorage.getItem(LEGACY_STORAGE_KEYS.removedBarcodes),

    AsyncStorage.getItem(LEGACY_STORAGE_KEYS.themePreference),
  ]);

  const rawInventory = safeParseJson<unknown[]>(
    inventoryRaw,
    [],
    LEGACY_STORAGE_KEYS.inventory,
    errors
  );

  const rawBills = safeParseJson<unknown[]>(billsRaw, [], LEGACY_STORAGE_KEYS.bills, errors);

  const rawCategories = safeParseJson<unknown[]>(
    categoriesRaw,
    [],
    LEGACY_STORAGE_KEYS.categories,
    errors
  );

  const rawRemovedBarcodes = safeParseJson<unknown[]>(
    removedBarcodesRaw,
    [],
    LEGACY_STORAGE_KEYS.removedBarcodes,
    errors
  );

  const themePreference = safeParseJson<'light' | 'dark' | null>(
    themeRaw,
    null,
    LEGACY_STORAGE_KEYS.themePreference,
    errors
  );

  return {
    payload: {
      inventory: normalizeLegacyInventory(rawInventory, errors),

      bills: normalizeLegacyBills(rawBills, errors),

      categories: Array.isArray(rawCategories)
        ? rawCategories.filter(
            (category): category is string =>
              typeof category === 'string' && Boolean(category.trim())
          )
        : [],

      removedBarcodes: Array.isArray(rawRemovedBarcodes)
        ? rawRemovedBarcodes.filter(
            (barcode): barcode is string => typeof barcode === 'string' && Boolean(barcode.trim())
          )
        : [],

      themePreference:
        themePreference === 'light' || themePreference === 'dark' ? themePreference : null,
    },

    errors,
  };
};

export const migrateLegacyAsyncStorage = async (): Promise<LegacyMigrationResult> => {
  await runMigrations();

  const db = await getDatabase();

  if (await isLegacyMigrationComplete(db)) {
    return {
      skipped: true,

      importedProducts: 0,

      importedBills: 0,

      importedCategories: 0,

      errors: [],
    };
  }

  const { payload, errors } = await readLegacyPayload();

  let backupId = '';

  await executeExclusive(db, async (txn) => {
    backupId = await recordBackupSnapshot(payload, txn);

    await replaceCategoriesByName(payload.categories, txn);

    for (const item of payload.inventory) {
      await upsertInventoryItem(item, txn);
    }

    for (const bill of payload.bills) {
      await importLegacySale(bill, txn);
    }

    if (payload.themePreference) {
      await setSetting('themePreference', payload.themePreference, txn);
    }

    await setSetting(LEGACY_STORAGE_KEYS.removedBarcodes, payload.removedBarcodes, txn);

    const importedCategories = (await listCategories(txn)).length;

    const result = {
      skipped: false,

      backupId,

      importedProducts: payload.inventory.length,

      importedBills: payload.bills.length,

      importedCategories,

      errors,
    };

    await recordMigrationAudit(
      'legacy_async_storage_migration',

      'Legacy AsyncStorage data imported into SQLite',

      result,

      txn
    );

    // Preserve every source key and expose quarantined-row diagnostics in Settings.
    await setSetting('legacy_migration_needs_review', errors.length > 0, txn);
    await markLegacyMigrationComplete(result, txn);
  });

  return {
    skipped: false,

    backupId,

    importedProducts: payload.inventory.length,

    importedBills: payload.bills.length,

    importedCategories: payload.categories.length,

    errors,
  };
};
