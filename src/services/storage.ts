import AsyncStorage from '@react-native-async-storage/async-storage';

import Constants from 'expo-constants';

import type { Bill, BillItem, InventoryItem } from '../types';

import { runMigrations, LATEST_MIGRATION_ID, SCHEMA_VERSION } from '../db/migrate';

import {
  buildManifest,
  validateBackup,
  type BackupManifest,
  type BackupValidation,
} from '../domain/backupManifest';

import { migrateLegacyAsyncStorage } from './legacyAsyncStorageMigration';

import { listCategories, replaceCategoriesByName } from '../repositories/categoryRepository';

import {
  createProduct,
  getProductByBarcode,
  listProducts,
  replaceInventorySnapshot,
  searchProducts,
  toInventoryItem,
  updateProduct,
} from '../repositories/productRepository';

import {
  createSaleTransaction,
  getSaleById,
  importLegacySale,
  listSalesByDateRange,
  toLegacyBill,
} from '../repositories/saleRepository';

import { adjustStockWithReason, listLowStockProducts } from '../repositories/inventoryRepository';

import {
  getBusinessProfile,
  getSetting,
  setSetting,
  updateBusinessProfile,
  type BusinessProfile,
} from '../repositories/settingsRepository';

import { createReceiptHtml, formatReceiptData } from '../domain/receipt';

import {
  getPeriodRange,
  getPresetRange,
  type ReportPeriod,
  type ReportPreset,
} from '../domain/reports';

import { productsToCsv } from '../domain/backup';

import { getReport } from '../repositories/reportRepository';

import { inTransaction } from '../db/database';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface BackupSnapshot {
  manifest: BackupManifest;

  schemaVersion: number;

  createdAt: string;

  inventory: InventoryItem[];

  bills: Bill[];

  categories: string[];

  removedBarcodes: string[];

  themePreference: ThemePreference | null;
}

const STORAGE_KEYS = {
  inventory: 'inventory',

  bills: 'bills',

  categories: 'categories',

  removedBarcodes: 'removedBarcodes',

  themePreference: 'themePreference',
} as const;

let dataLayerReadyPromise: Promise<void> | null = null;

const ensureDataLayerReady = async (): Promise<void> => {
  if (!dataLayerReadyPromise) {
    dataLayerReadyPromise = (async () => {
      await runMigrations();

      await migrateLegacyAsyncStorage();
    })().catch((error) => {
      dataLayerReadyPromise = null;
      throw error;
    });
  }

  await dataLayerReadyPromise;
};

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const value = await AsyncStorage.getItem(key);

    return value ? (JSON.parse(value) as T) : fallback;
  } catch (error) {
    console.error(`Error reading storage key "${key}":`, error);

    return fallback;
  }
};

const writeJson = async <T>(key: string, value: T): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));

    return true;
  } catch (error) {
    console.error(`Error writing storage key "${key}":`, error);

    return false;
  }
};

export interface CreateBillInput {
  id: string;

  items: BillItem[];

  total?: number;

  customerName: string;

  customerPhone?: string;

  timestamp: number;

  paymentMethod: string;

  billDiscount?: number;

  taxRate?: number;
}

export const storageService = {
  keys: STORAGE_KEYS,

  ensureDataLayerReady,

  getInventory: async () => {
    await ensureDataLayerReady();

    const products = await listProducts();

    return products.map(toInventoryItem);
  },

  searchInventory: async (query: string, limit = 50) => {
    await ensureDataLayerReady();

    const products = await searchProducts(query, limit);

    return products.map(toInventoryItem);
  },

  getInventoryItemByBarcode: async (barcode: string) => {
    await ensureDataLayerReady();

    const product = await getProductByBarcode(barcode);

    return product ? toInventoryItem(product) : null;
  },

  saveInventory: async (inventory: InventoryItem[]) => {
    await ensureDataLayerReady();

    await replaceInventorySnapshot(inventory);

    return true;
  },

  updateInventoryItem: async (item: InventoryItem, stockReason = 'Inventory edit') => {
    await ensureDataLayerReady();

    const product = await getProductByBarcode(item.barcode);

    if (!product) {
      await createProduct(item);

      return true;
    }

    await inTransaction(async (txn) => {
      await updateProduct(
        product.id,
        {
          barcode: item.barcode,

          name: item.name,

          price: item.price,

          category: item.category,

          imageUri: item.imageUri,

          unit: item.unit,
          lowStockThreshold: item.lowStockThreshold,
          costPrice: item.costPrice,
          expectedVersion: item.version,
        },
        txn
      );

      if (item.quantity !== product.stockQuantity) {
        await adjustStockWithReason(product.id, item.quantity, stockReason, txn);
      }
    });

    return true;
  },

  getBills: async () => {
    await ensureDataLayerReady();

    const sales = await listSalesByDateRange();

    return sales.map(toLegacyBill);
  },

  saveBills: async (bills: Bill[]) => {
    await ensureDataLayerReady();

    for (const bill of bills) {
      await importLegacySale(bill);
    }

    return true;
  },

  createBill: async (bill: CreateBillInput) => {
    await ensureDataLayerReady();

    const sale = await createSaleTransaction({
      id: bill.id,

      saleNumber: bill.id,

      customerName: bill.customerName,

      customerPhone: bill.customerPhone,

      saleDate: bill.timestamp,

      paymentMethod: bill.paymentMethod,

      billDiscountCents: Math.round((bill.billDiscount ?? 0) * 100),

      taxRate: bill.taxRate ?? 0,

      items: bill.items.map((item) => ({
        barcode: item.id,

        quantity: item.quantity,

        unitPriceCents: Math.round(item.price * 100),

        discountCents: Math.round(((item as BillItem & { discount?: number }).discount ?? 0) * 100),
      })),

      payments: [
        {
          method: bill.paymentMethod,

          amountCents: Math.round((bill.total ?? 0) * 100),
        },
      ],
    });

    return toLegacyBill(sale);
  },

  getBillById: async (id: string) => {
    await ensureDataLayerReady();

    const sale = await getSaleById(id);

    return sale ? toLegacyBill(sale) : null;
  },

  getReceiptData: async (id: string) => {
    await ensureDataLayerReady();

    const sale = await getSaleById(id);

    if (!sale) {
      return null;
    }

    const profile = await getBusinessProfile();

    return formatReceiptData(
      sale,
      sale.seller ??
        (profile ? { ...profile, currencyCode: sale.currencyCode ?? profile.currencyCode } : null)
    );
  },

  getReceiptHtml: async (id: string) => {
    const receipt = await storageService.getReceiptData(id);

    return receipt ? createReceiptHtml(receipt) : null;
  },

  getSalesReport: async (period: ReportPeriod, date = new Date()) => {
    await ensureDataLayerReady();

    const range = getPeriodRange(period, date);

    return getReport(range.start, range.end, period);
  },

  getSalesReportByPreset: async (preset: ReportPreset, date = new Date()) => {
    await ensureDataLayerReady();

    const range = getPresetRange(preset, date);

    return getReport(range.start, range.end, preset);
  },

  getSalesReportForRange: async (startDate: number, endDate: number, label: string) => {
    await ensureDataLayerReady();

    return getReport(startDate, endDate, label);
  },

  getDailyClosingSummary: async (date = new Date()) => {
    return storageService.getSalesReport('daily', date);
  },

  getCategories: async () => {
    await ensureDataLayerReady();

    const categories = await listCategories();

    return categories.map((category) => category.name);
  },

  saveCategories: async (categories: string[]) => {
    await ensureDataLayerReady();

    await replaceCategoriesByName(categories);

    return true;
  },

  getRemovedBarcodes: async () => {
    await ensureDataLayerReady();

    return getSetting<string[]>(STORAGE_KEYS.removedBarcodes, []);
  },

  saveRemovedBarcodes: async (removedBarcodes: string[]) => {
    await ensureDataLayerReady();

    await setSetting(STORAGE_KEYS.removedBarcodes, removedBarcodes);

    return true;
  },

  getLowStockProducts: async () => {
    await ensureDataLayerReady();

    const products = await listLowStockProducts();

    return products.map((product) => ({
      barcode: product.barcode,

      name: product.name,

      quantity: product.quantity,

      price: 0,
    }));
  },

  getBusinessProfile: async () => {
    await ensureDataLayerReady();

    return getBusinessProfile();
  },

  saveBusinessProfile: async (profile: Partial<BusinessProfile>) => {
    await ensureDataLayerReady();

    await updateBusinessProfile(profile);

    return true;
  },

  getThemePreference: () => readJson<ThemePreference | null>(STORAGE_KEYS.themePreference, null),

  saveThemePreference: (preference: ThemePreference) =>
    writeJson(STORAGE_KEYS.themePreference, preference),

  buildBackupSnapshot: async (): Promise<BackupSnapshot> => {
    const [inventory, bills, categories, removedBarcodes, themePreference] = await Promise.all([
      storageService.getInventory(),

      storageService.getBills(),

      storageService.getCategories(),

      storageService.getRemovedBarcodes(),

      storageService.getThemePreference(),
    ]);

    const appVersion = Constants.expoConfig?.version ?? '2.0.0';

    const manifest = buildManifest({
      appVersion,

      schemaVersion: SCHEMA_VERSION,

      latestMigrationId: LATEST_MIGRATION_ID,

      data: { inventory, bills, categories, removedBarcodes },
    });

    return {
      manifest,

      schemaVersion: SCHEMA_VERSION,

      createdAt: manifest.exportedAt,

      inventory,

      bills,

      categories,

      removedBarcodes,

      themePreference,
    };
  },

  /** Validate a parsed backup file before any restore (checksum + preview). */

  validateBackup: (parsed: unknown): BackupValidation => validateBackup(parsed),

  exportProductsCsv: async () => {
    const inventory = await storageService.getInventory();

    return productsToCsv(inventory);
  },

  importProductsCsv: async (_csv: string) => {
    throw new Error('Use the reviewed CSV import workflow.');
  },
};
