import { getDatabase, inTransaction, type DbExecutor } from "../db/database";
import { nowIso } from "../db/schema";
import { parseCsv, reviewProductsCsv } from "../domain/backup";
import {
  createProduct,
  getProductByBarcode,
  updateProduct,
} from "./productRepository";
export const applyCsvImport = async (
  input: {
    id: string;
    csv: string;
    mode: "metadata" | "count";
    versions: Record<string, number>;
  },
  db?: DbExecutor,
): Promise<number> =>
  inTransaction(async (txn) => {
    const previous = await txn.getFirstAsync<{ rows_count: number }>(
      "SELECT rows_count FROM import_runs WHERE id=?",
      [input.id],
    );
    if (previous) return previous.rows_count;
    const review = reviewProductsCsv(input.csv);
    if (review.errors.length)
      throw new Error("Resolve every CSV error before importing");
    const columns = parseCsv(input.csv.replace(/^\uFEFF/, ""))[0].map((s) =>
      s.trim(),
    );
    for (const item of review.rows) {
      const current = await getProductByBarcode(item.barcode, txn);
      if (current) {
        if (input.versions[item.barcode] !== current.version)
          throw new Error(
            `${item.name} changed since preview. Review the file again.`,
          );
        const { quantity, ...metadata } = item;
        for (const key of [
          "unit",
          "costPrice",
          "lowStockThreshold",
          "category",
        ] as const)
          if (!columns.includes(key)) delete metadata[key];
        await updateProduct(
          current.id,
          {
            ...metadata,
            ...(input.mode === "count"
              ? { quantity, stockReason: "Reviewed CSV stock count" }
              : {}),
            expectedVersion: current.version,
          },
          txn,
        );
      } else {
        if (input.versions[item.barcode] !== undefined)
          throw new Error("Inventory changed. Review the file again.");
        await createProduct(item, txn);
      }
    }
    await txn.runAsync(
      "INSERT INTO import_runs(id,kind,rows_count,created_at) VALUES(?,?,?,?)",
      [input.id, "product-csv", review.rows.length, nowIso()],
    );
    return review.rows.length;
  }, db);
export const previewCsvImport = async (csv: string, db?: DbExecutor) => {
  const review = reviewProductsCsv(csv);
  const database = db ?? (await getDatabase());
  const versions: Record<string, number> = Object.create(null);
  const existing: Record<
    string,
    {
      quantity: number;
      price: number;
      unit: string;
      cost: number | null;
      lowStockThreshold: number;
    }
  > = Object.create(null);
  for (let offset = 0; offset < review.rows.length; offset += 300) {
    const codes = review.rows.slice(offset, offset + 300).map((p) => p.barcode);
    const products = await database.getAllAsync<{
      barcode: string;
      stock_quantity: number;
      price_cents: number;
      unit: string;
      cost_cents: number | null;
      low_stock_threshold: number;
      version: number;
      deleted_at: string | null;
    }>(
      `SELECT barcode,stock_quantity,price_cents,unit,cost_cents,low_stock_threshold,version,deleted_at FROM products WHERE barcode IN (${codes.map(() => "?").join(",")})`,
      codes,
    );
    for (const p of products) {
      if (p.deleted_at)
        review.errors.push({
          row: review.rows.findIndex((r) => r.barcode === p.barcode) + 2,
          message: `${p.barcode} is archived. Restore it before import.`,
        });
      else {
        versions[p.barcode] = p.version;
        existing[p.barcode] = {
          quantity: p.stock_quantity,
          price: p.price_cents / 100,
          unit: p.unit,
          lowStockThreshold: p.low_stock_threshold,
          cost: p.cost_cents == null ? null : p.cost_cents / 100,
        };
      }
    }
  }
  return {
    ...review,
    versions,
    existing,
    columns:
      parseCsv(csv.replace(/^\uFEFF/, ""))[0]?.map((s) => s.trim()) ?? [],
  };
};
