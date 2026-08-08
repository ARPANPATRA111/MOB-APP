import type { InventoryItem } from '../types';
import { toCents, fromCents } from '../domain/money';
import { normalizeBarcode, normalizeName, validateProductInput } from '../domain/validation';
import { getDatabase, type DbExecutor } from '../db/database';
import { createStableLegacyId, nowIso, SYNC_STATUS_PENDING } from '../db/schema';
import { ensureCategoryByName } from './categoryRepository';
import { createStockMovement } from './inventoryRepository';

export interface ProductRecord {
  id: string;
  barcode: string;
  name: string;
  categoryId?: string | null;
  categoryName?: string | null;
  priceCents: number;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUri?: string | null;
  deletedAt?: string | null;
}

interface ProductRow {
  id: string;
  barcode: string;
  name: string;
  category_id: string | null;
  category_name?: string | null;
  price_cents: number;
  stock_quantity: number;
  low_stock_threshold: number;
  image_uri: string | null;
  deleted_at: string | null;
}

export interface ProductInput {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  imageUri?: string;
  lowStockThreshold?: number;
}

const dbOrDefault = async (db?: DbExecutor) => db ?? (await getDatabase());

const toRecord = (row: ProductRow): ProductRecord => ({
  id: row.id,
  barcode: row.barcode,
  name: row.name,
  categoryId: row.category_id,
  categoryName: row.category_name,
  priceCents: row.price_cents,
  stockQuantity: row.stock_quantity,
  lowStockThreshold: row.low_stock_threshold,
  imageUri: row.image_uri,
  deletedAt: row.deleted_at,
});

export const toInventoryItem = (product: ProductRecord): InventoryItem => ({
  barcode: product.barcode,
  name: product.name,
  quantity: product.stockQuantity,
  price: fromCents(product.priceCents),
  category: product.categoryName ?? undefined,
  imageUri: product.imageUri ?? undefined,
});

const selectProductSql = `
  SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
`;

export const getProductByBarcode = async (
  barcode: string,
  db?: DbExecutor
): Promise<ProductRecord | null> => {
  const database = await dbOrDefault(db);
  const row = await database.getFirstAsync<ProductRow>(
    `${selectProductSql} WHERE p.barcode = ? AND p.deleted_at IS NULL`,
    [normalizeBarcode(barcode)]
  );
  return row ? toRecord(row) : null;
};

export const getProductById = async (
  id: string,
  db?: DbExecutor
): Promise<ProductRecord | null> => {
  const database = await dbOrDefault(db);
  const row = await database.getFirstAsync<ProductRow>(
    `${selectProductSql} WHERE p.id = ? AND p.deleted_at IS NULL`,
    [id]
  );
  return row ? toRecord(row) : null;
};

export const hasDuplicateBarcode = async (
  barcode: string,
  excludeProductId?: string,
  db?: DbExecutor
): Promise<boolean> => {
  const database = await dbOrDefault(db);
  const row = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM products
      WHERE barcode = ? AND deleted_at IS NULL AND (? IS NULL OR id != ?)
      LIMIT 1`,
    [normalizeBarcode(barcode), excludeProductId ?? null, excludeProductId ?? null]
  );
  return Boolean(row);
};

export const createProduct = async (
  input: ProductInput,
  db?: DbExecutor
): Promise<ProductRecord> => {
  const database = await dbOrDefault(db);
  const validation = validateProductInput(input);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  const barcode = normalizeBarcode(input.barcode);
  const existing = await getProductByBarcode(barcode, database);
  if (existing) {
    throw new Error('A product with this barcode already exists');
  }

  const category = await ensureCategoryByName(input.category, database);
  const id = createStableLegacyId('product', barcode);
  const now = nowIso();

  await database.runAsync(
    `INSERT INTO products (
      id, barcode, name, category_id, price_cents, stock_quantity,
      low_stock_threshold, image_uri, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      barcode,
      normalizeName(input.name),
      category?.id ?? null,
      toCents(input.price),
      input.quantity,
      input.lowStockThreshold ?? 5,
      input.imageUri ?? null,
      now,
      now,
      SYNC_STATUS_PENDING,
    ]
  );

  await database.runAsync(
    `INSERT INTO inventory_movements (
      id, product_id, movement_type, quantity_delta, stock_after, reason,
      reference_type, reference_id, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, 'initial', ?, ?, 'Initial stock', 'product', ?, ?, ?, ?, 1)`,
    [
      createStableLegacyId('movement-initial', id),
      id,
      input.quantity,
      input.quantity,
      id,
      now,
      now,
      SYNC_STATUS_PENDING,
    ]
  );

  const product = await getProductById(id, database);
  if (!product) {
    throw new Error('Failed to create product');
  }

  return product;
};

export const updateProduct = async (
  id: string,
  updates: Partial<ProductInput>,
  db?: DbExecutor
): Promise<void> => {
  const database = await dbOrDefault(db);
  const current = await getProductById(id, database);
  if (!current) {
    throw new Error('Product not found');
  }

  const nextBarcode = updates.barcode ? normalizeBarcode(updates.barcode) : current.barcode;
  if (await hasDuplicateBarcode(nextBarcode, id, database)) {
    throw new Error('A product with this barcode already exists');
  }

  const category = await ensureCategoryByName(
    updates.category ?? current.categoryName ?? undefined,
    database
  );
  const now = nowIso();

  await database.runAsync(
    `UPDATE products
      SET barcode = ?, name = ?, category_id = ?, price_cents = ?, image_uri = ?,
          low_stock_threshold = ?, updated_at = ?, sync_status = ?, version = version + 1
      WHERE id = ?`,
    [
      nextBarcode,
      updates.name ? normalizeName(updates.name) : current.name,
      category?.id ?? null,
      updates.price !== undefined ? toCents(updates.price) : current.priceCents,
      updates.imageUri ?? current.imageUri ?? null,
      updates.lowStockThreshold ?? current.lowStockThreshold,
      now,
      SYNC_STATUS_PENDING,
      id,
    ]
  );

  if (updates.quantity !== undefined && updates.quantity !== current.stockQuantity) {
    await createStockMovement(
      {
        productId: id,
        quantityDelta: updates.quantity - current.stockQuantity,
        movementType: 'adjustment',
        reason: 'Inventory edit',
        referenceType: 'product',
        referenceId: id,
      },
      database
    );
  }
};

export const softDeleteProduct = async (id: string, db?: DbExecutor): Promise<void> => {
  const database = await dbOrDefault(db);
  await database.runAsync(
    `UPDATE products
      SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
      WHERE id = ?`,
    [nowIso(), nowIso(), SYNC_STATUS_PENDING, id]
  );
};

export const listProducts = async (db?: DbExecutor): Promise<ProductRecord[]> => {
  const database = await dbOrDefault(db);
  const rows = await database.getAllAsync<ProductRow>(
    `${selectProductSql}
      WHERE p.deleted_at IS NULL
      ORDER BY p.name ASC`
  );
  return rows.map(toRecord);
};

export const searchProducts = async (
  query: string,
  limit = 50,
  db?: DbExecutor
): Promise<ProductRecord[]> => {
  const database = await dbOrDefault(db);
  const like = `%${query.trim()}%`;
  const rows = await database.getAllAsync<ProductRow>(
    `${selectProductSql}
      WHERE p.deleted_at IS NULL AND (p.name LIKE ? OR p.barcode LIKE ?)
      ORDER BY p.name ASC
      LIMIT ?`,
    [like, like, limit]
  );
  return rows.map(toRecord);
};

export const upsertInventoryItem = async (
  item: InventoryItem,
  db?: DbExecutor
): Promise<ProductRecord> => {
  const database = await dbOrDefault(db);
  const barcode = normalizeBarcode(item.barcode);
  const existing = await getProductByBarcode(barcode, database);

  if (!existing) {
    return createProduct(
      {
        barcode,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category,
        imageUri: item.imageUri,
      },
      database
    );
  }

  await updateProduct(
    existing.id,
    {
      barcode,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      category: item.category,
      imageUri: item.imageUri,
    },
    database
  );

  const product = await getProductById(existing.id, database);
  if (!product) {
    throw new Error('Failed to update product');
  }
  return product;
};

export const replaceInventorySnapshot = async (
  items: InventoryItem[],
  db?: DbExecutor
): Promise<void> => {
  const database = await dbOrDefault(db);
  const incomingBarcodes = new Set(items.map((item) => normalizeBarcode(item.barcode)));
  const existingProducts = await listProducts(database);

  for (const item of items) {
    await upsertInventoryItem(item, database);
  }

  for (const product of existingProducts) {
    if (!incomingBarcodes.has(product.barcode)) {
      await softDeleteProduct(product.id, database);
    }
  }
};
