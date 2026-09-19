import {
  escapeLike,
  fuzzyLikePatterns,
  parseCatalogQuery,
} from "../domain/catalogSearch";
import type { InventoryItem } from "../types";

import { toCents, fromCents } from "../domain/money";

import { normalizeBarcode, normalizeName } from "../domain/validation";

import {
  PRODUCT_UNITS,
  validateQuantity,
  assertMinorUnits,
} from "../domain/commerce";

import { getDatabase, inTransaction, type DbExecutor } from "../db/database";

import { createLocalId, nowIso } from "../db/schema";

import { ensureCategoryByName } from "./categoryRepository";

import { createStockMovement } from "./inventoryRepository";

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
  unit: string;
  costCents: number | null;
  version: number;
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
  unit: string;
  cost_cents: number | null;
  version: number;
}

export interface ProductInput {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  imageUri?: string | null;
  lowStockThreshold?: number;
  unit?: string;
  costPrice?: number | null;
  expectedVersion?: number;
  stockReason?: string;
}

const toRecord = (r: ProductRow): ProductRecord => ({
  id: r.id,
  barcode: r.barcode,
  name: r.name,
  categoryId: r.category_id,
  categoryName: r.category_name,
  priceCents: r.price_cents,
  stockQuantity: r.stock_quantity,
  lowStockThreshold: r.low_stock_threshold,
  imageUri: r.image_uri,
  deletedAt: r.deleted_at,
  unit: r.unit ?? "piece",
  costCents: r.cost_cents ?? null,
  version: r.version,
});

export const toInventoryItem = (p: ProductRecord): InventoryItem => ({
  id: p.id,
  barcode: p.barcode,
  name: p.name,
  quantity: p.stockQuantity,
  price: fromCents(p.priceCents),
  category: p.categoryName ?? undefined,
  imageUri: p.imageUri ?? undefined,
  unit: p.unit,
  costPrice: p.costCents === null ? null : fromCents(p.costCents),
  lowStockThreshold: p.lowStockThreshold,
  version: p.version,
});

const selectSql =
  "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id";

export const getProductByBarcode = async (
  barcode: string,
  db?: DbExecutor,
): Promise<ProductRecord | null> => {
  const row = await (db ?? (await getDatabase())).getFirstAsync<ProductRow>(
    `${selectSql} WHERE p.barcode=? AND p.deleted_at IS NULL`,
    [normalizeBarcode(barcode)],
  );
  return row ? toRecord(row) : null;
};

export const getProductById = async (
  id: string,
  db?: DbExecutor,
): Promise<ProductRecord | null> => {
  const row = await (db ?? (await getDatabase())).getFirstAsync<ProductRow>(
    `${selectSql} WHERE p.id=? AND p.deleted_at IS NULL`,
    [id],
  );
  return row ? toRecord(row) : null;
};

export const hasDuplicateBarcode = async (
  barcode: string,
  excludeProductId?: string,
  db?: DbExecutor,
) =>
  Boolean(
    await (db ?? (await getDatabase())).getFirstAsync(
      "SELECT id FROM products WHERE barcode=? AND (? IS NULL OR id!=?)",
      [
        normalizeBarcode(barcode),
        excludeProductId ?? null,
        excludeProductId ?? null,
      ],
    ),
  );

const validate = (i: ProductInput) => {
  if (
    !i.barcode.trim() ||
    i.barcode.trim().length > 128 ||
    /[\x00-\x1f]/.test(i.barcode)
  )
    throw new Error("Enter a barcode or internal code (up to 128 characters)");

  if (!i.name.trim() || i.name.length > 200)
    throw new Error("Enter a product name (up to 200 characters)");

  if (!PRODUCT_UNITS.includes((i.unit ?? "piece") as never))
    throw new Error("Choose a valid product unit");

  validateQuantity(i.quantity, i.unit ?? "piece", true);
  assertMinorUnits(toCents(i.price), "Price");

  validateQuantity(i.lowStockThreshold ?? 5, "kg", true);

  if (i.costPrice != null) assertMinorUnits(toCents(i.costPrice), "Cost");
};

export const createProduct = async (
  input: ProductInput,
  db?: DbExecutor,
): Promise<ProductRecord> =>
  inTransaction(async (txn) => {
    validate(input);
    const barcode = normalizeBarcode(input.barcode);

    if (await hasDuplicateBarcode(barcode, undefined, txn))
      throw new Error(
        "This barcode exists. Restore the archived product or use another code.",
      );

    const category = await ensureCategoryByName(input.category, txn);
    const id = createLocalId("product");
    const now = nowIso();

    await txn.runAsync(
      `INSERT INTO products(id,barcode,name,category_id,price_cents,stock_quantity,low_stock_threshold,image_uri,unit,cost_cents,created_at,updated_at,sync_status,version) VALUES(?,?,?,?,?,0,?,?,?,?,?,?,'pending',1)`,
      [
        id,
        barcode,
        normalizeName(input.name),
        category?.id ?? null,
        toCents(input.price),
        input.lowStockThreshold ?? 5,
        input.imageUri ?? null,
        input.unit ?? "piece",
        input.costPrice == null ? null : toCents(input.costPrice),
        now,
        now,
      ],
    );

    await createStockMovement(
      {
        productId: id,
        quantityDelta: input.quantity,
        movementType: "initial",
        reason: "Opening stock",
      },
      txn,
    );

    return (await getProductById(id, txn))!;
  }, db);

export const updateProduct = async (
  id: string,
  updates: Partial<ProductInput>,
  db?: DbExecutor,
): Promise<void> =>
  inTransaction(async (txn) => {
    const current = await getProductById(id, txn);
    if (!current) throw new Error("Product not found");

    if (
      updates.expectedVersion !== undefined &&
      updates.expectedVersion !== current.version
    )
      throw new Error("This product changed. Refresh it before saving.");

    const next: ProductInput = {
      barcode: current.barcode,
      name: current.name,
      quantity: current.stockQuantity,
      price: fromCents(current.priceCents),
      category: current.categoryName ?? "",
      unit: current.unit,
      lowStockThreshold: current.lowStockThreshold,
      imageUri: current.imageUri,
      costPrice:
        current.costCents === null ? null : fromCents(current.costCents),
      ...Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined),
      ),
    };

    validate(next);
    if (await hasDuplicateBarcode(next.barcode, id, txn))
      throw new Error("This barcode already exists");

    if (next.unit !== current.unit && current.stockQuantity !== 0)
      throw new Error(
        "Set stock to zero with a reason before changing its unit",
      );

    const category = await ensureCategoryByName(next.category, txn);

    await txn.runAsync(
      `UPDATE products SET barcode=?,name=?,category_id=?,price_cents=?,image_uri=?,low_stock_threshold=?,unit=?,cost_cents=?,updated_at=?,sync_status='pending',version=version+1 WHERE id=?`,
      [
        normalizeBarcode(next.barcode),
        normalizeName(next.name),
        category?.id ?? null,
        toCents(next.price),
        next.imageUri ?? null,
        next.lowStockThreshold ?? 5,
        next.unit,
        next.costPrice == null ? null : toCents(next.costPrice),
        nowIso(),
        id,
      ],
    );

    if (next.quantity !== current.stockQuantity) {
      if (!updates.stockReason?.trim())
        throw new Error("Stock adjustment reason is required");
      await createStockMovement(
        {
          productId: id,
          quantityDelta: next.quantity - current.stockQuantity,
          movementType: "adjustment",
          reason: updates.stockReason,
        },
        txn,
      );
    }

    await txn.runAsync(
      `INSERT INTO audit_logs(id,entity_type,entity_id,action,message,created_at) VALUES(?,'product',?,'edit','Product updated',?)`,
      [createLocalId("audit"), id, nowIso()],
    );
  }, db);

export const softDeleteProduct = async (
  id: string,
  db?: DbExecutor,
): Promise<void> =>
  inTransaction(async (txn) => {
    await txn.runAsync(
      `UPDATE products SET deleted_at=?,updated_at=?,sync_status='pending',version=version+1 WHERE id=?`,
      [nowIso(), nowIso(), id],
    );

    await txn.runAsync(
      `INSERT INTO audit_logs(id,entity_type,entity_id,action,message,created_at) VALUES(?,'product',?,'archive','Product archived',?)`,
      [createLocalId("audit"), id, nowIso()],
    );
  }, db);

export const restoreProduct = async (
  id: string,
  db?: DbExecutor,
): Promise<void> =>
  inTransaction(async (txn) => {
    await txn.runAsync(
      `UPDATE products SET deleted_at=NULL,updated_at=?,version=version+1 WHERE id=?`,
      [nowIso(), id],
    );
  }, db);

export const listProducts = async (db?: DbExecutor): Promise<ProductRecord[]> =>
  (
    await (db ?? (await getDatabase())).getAllAsync<ProductRow>(
      `${selectSql} WHERE p.deleted_at IS NULL ORDER BY p.name COLLATE NOCASE,p.id`,
    )
  ).map(toRecord);

export interface ProductPageOptions {
  query?: string;
  category?: string;
  stock?: "all" | "in" | "low" | "out" | "archived";
  sort?: "name" | "price-desc" | "price-asc" | "stock-asc";
  after?: { value: string | number; id: string };
  limit?: number;
}

export const listProductPage = async (
  options: ProductPageOptions = {},
  db?: DbExecutor,
): Promise<ProductRecord[]> => {
  const sort = options.sort ?? "name";
  const column =
    sort === "name"
      ? "p.name COLLATE NOCASE"
      : sort === "stock-asc"
        ? "p.stock_quantity"
        : "p.price_cents";
  const direction = sort === "price-desc" ? "DESC" : "ASC";

  const where = [
    options.stock === "archived"
      ? "p.deleted_at IS NOT NULL"
      : "p.deleted_at IS NULL",
  ];
  const params: (string | number)[] = [];

  if (options.category && options.category !== "All") {
    where.push("COALESCE(c.name, 'Uncategorized')=?");
    params.push(options.category);
  }

  if (options.stock === "in") where.push("p.stock_quantity>0");

  if (options.stock === "low")
    where.push("p.stock_quantity<=p.low_stock_threshold");

  if (options.stock === "out") where.push("p.stock_quantity=0");

  const database = db ?? (await getDatabase());
  const query = parseCatalogQuery(options.query ?? "");
  if (query.text) {
    const like = `%${escapeLike(query.text)}%`;
    const exactSql =
      "(p.name LIKE ? ESCAPE '\\' OR p.barcode LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\'" +
      (query.priceCents !== null ? " OR p.price_cents=?" : "") +
      ")";
    const exactParams: (string | number)[] = [like, like, like];
    if (query.priceCents !== null) exactParams.push(query.priceCents);
    const patterns = fuzzyLikePatterns(query.text);
    // Typo fallback only if the filtered catalog has no literal match. This choice
    // ignores the page cursor, so later pages cannot switch search modes.
    const literal = patterns.length
      ? await database.getFirstAsync(
          `${selectSql} WHERE ${where.join(" AND ")} AND ${exactSql} LIMIT 1`,
          [...params, ...exactParams],
        )
      : true;
    if (literal) {
      where.push(exactSql);
      params.push(...exactParams);
    } else {
      where.push(
        "(" +
          patterns.map(() => "(p.name LIKE ? OR c.name LIKE ?)").join(" OR ") +
          ")",
      );
      params.push(...patterns.flatMap((pattern) => [pattern, pattern]));
    }
  }

  if (options.after) {
    const op = direction === "DESC" ? "<" : ">";
    where.push(`(${column}${op}? OR (${column}=? AND p.id>?))`);
    params.push(options.after.value, options.after.value, options.after.id);
  }

  params.push(Math.min(100, Math.max(1, options.limit ?? 40)));

  return (
    await database.getAllAsync<ProductRow>(
      `${selectSql} WHERE ${where.join(" AND ")} ORDER BY ${column} ${direction},p.id ASC LIMIT ?`,
      params,
    )
  ).map(toRecord);
};

export const searchProducts = async (
  query: string,
  limit = 50,
  db?: DbExecutor,
) => listProductPage({ query, limit, stock: "in" }, db);

export const upsertInventoryItem = async (
  item: InventoryItem,
  db?: DbExecutor,
): Promise<ProductRecord> =>
  inTransaction(async (txn) => {
    const current = await getProductByBarcode(item.barcode, txn);

    if (!current)
      return createProduct({ ...item, unit: item.unit ?? "piece" }, txn);

    await updateProduct(
      current.id,
      { ...item, stockReason: "Reviewed import" },
      txn,
    );
    return (await getProductById(current.id, txn))!;
  }, db);

// Compatibility only: merge supplied records; absence is never authority to delete.

export const replaceInventorySnapshot = async (
  items: InventoryItem[],
  db?: DbExecutor,
): Promise<void> =>
  inTransaction(async (txn) => {
    for (const item of items) await upsertInventoryItem(item, txn);
  }, db);
