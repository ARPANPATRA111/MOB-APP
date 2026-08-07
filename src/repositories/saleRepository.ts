import type { Bill } from '../types';
import { calculateCartTotals } from '../domain/billing';
import { assertCanDeductStock } from '../domain/inventory';
import { fromCents, toCents } from '../domain/money';
import { executeExclusive, getDatabase, type DbExecutor } from '../db/database';
import { createLocalId, nowIso, SYNC_STATUS_PENDING } from '../db/schema';
import { validatePayments, type PaymentMethod } from '../domain/payment';

interface ProductStockRow {
  id: string;
  barcode: string;
  name: string;
  price_cents: number;
  stock_quantity: number;
}

interface SaleRow {
  id: string;
  sale_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: number;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string | null;
  barcode: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
}

interface PaymentRow {
  method: PaymentMethod | string;
  amount_cents: number;
}

export interface SaleLineInput {
  productId?: string;
  barcode?: string;
  name?: string;
  quantity: number;
  unitPriceCents?: number;
  discountCents?: number;
}

export interface PaymentInput {
  method: string;
  amountCents?: number;
  reference?: string;
}

export interface CreateSaleInput {
  id?: string;
  saleNumber?: string;
  customerName?: string;
  saleDate?: number;
  paymentMethod?: string;
  customerPhone?: string;
  items: SaleLineInput[];
  payments?: PaymentInput[];
  billDiscountCents?: number;
  taxRate?: number;
}

export interface SaleRecord {
  id: string;
  saleNumber: string;
  customerName?: string;
  customerPhone?: string;
  saleDate: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  items: SaleItemRow[];
  payments: PaymentRow[];
}

const dbOrDefault = async (db?: DbExecutor) => db ?? (await getDatabase());

const getProductForSale = async (
  txn: DbExecutor,
  item: SaleLineInput
): Promise<ProductStockRow> => {
  const product = await txn.getFirstAsync<ProductStockRow>(
    `SELECT id, barcode, name, price_cents, stock_quantity
      FROM products
      WHERE deleted_at IS NULL AND (
        (? IS NOT NULL AND id = ?) OR (? IS NOT NULL AND barcode = ?)
      )
      LIMIT 1`,
    [
      item.productId ?? null,
      item.productId ?? null,
      item.barcode ?? null,
      item.barcode ?? null,
    ]
  );

  if (!product) {
    throw new Error(`Product not found for sale item ${item.barcode ?? item.productId ?? ''}`);
  }

  return product;
};

const aggregateSaleItems = (items: SaleLineInput[]): SaleLineInput[] => {
  const byKey = new Map<string, SaleLineInput>();
  for (const item of items) {
    const key = item.productId ?? item.barcode;
    if (!key) {
      throw new Error('Sale item requires productId or barcode');
    }

    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byKey.set(key, { ...item });
    }
  }

  return Array.from(byKey.values());
};

export const createSaleTransaction = async (
  input: CreateSaleInput,
  db?: DbExecutor
): Promise<SaleRecord> => {
  const database = await dbOrDefault(db);
  const saleId = input.id ?? createLocalId('sale');
  const saleNumber = input.saleNumber ?? saleId;
  let createdSale: SaleRecord | null = null;

  await executeExclusive(database, async (txn) => {
    const saleDate = input.saleDate ?? Date.now();
    const now = nowIso();
    const saleItems = aggregateSaleItems(input.items);

    if (saleItems.length === 0) {
      throw new Error('Sale requires at least one item');
    }

    const resolvedLines = [];
    for (const item of saleItems) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error('Sale item quantity must be a positive integer');
      }

      const product = await getProductForSale(txn, item);
      assertCanDeductStock(product.stock_quantity, item.quantity, product.name);
      resolvedLines.push({
        product,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents ?? product.price_cents,
        discountCents: item.discountCents ?? 0,
      });
    }

    const totals = calculateCartTotals(
      resolvedLines.map((line) => ({
        productId: line.product.id,
        barcode: line.product.barcode,
        name: line.product.name,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        availableStock: line.product.stock_quantity,
        discountCents: line.discountCents,
      })),
      input.billDiscountCents ?? 0,
      input.taxRate ?? 0
    );

    await txn.runAsync(
      `INSERT INTO sales (
        id, sale_number, customer_name, customer_phone, sale_date, subtotal_cents,
        discount_cents, tax_cents, total_cents, created_at, updated_at, sync_status, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        saleId,
        saleNumber,
        input.customerName?.trim() || null,
        input.customerPhone?.trim() || null,
        saleDate,
        totals.subtotalCents,
        totals.discountCents,
        totals.taxCents,
        totals.totalCents,
        now,
        now,
        SYNC_STATUS_PENDING,
      ]
    );

    const recordItems: SaleItemRow[] = [];
    for (const line of resolvedLines) {
      const totalCents = line.quantity * line.unitPriceCents - line.discountCents;
      const itemId = createLocalId('sale-item');
      const stockAfter = line.product.stock_quantity - line.quantity;

      await txn.runAsync(
        `INSERT INTO sale_items (
          id, sale_id, product_id, barcode, product_name, quantity, unit_price_cents,
          discount_cents, tax_cents, total_cents, created_at, updated_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1)`,
        [
          itemId,
          saleId,
          line.product.id,
          line.product.barcode,
          line.product.name,
          line.quantity,
          line.unitPriceCents,
          line.discountCents,
          totalCents,
          now,
          now,
          SYNC_STATUS_PENDING,
        ]
      );

      await txn.runAsync(
        `UPDATE products
          SET stock_quantity = ?, updated_at = ?, sync_status = ?, version = version + 1
          WHERE id = ?`,
        [stockAfter, now, SYNC_STATUS_PENDING, line.product.id]
      );

      await txn.runAsync(
        `INSERT INTO inventory_movements (
          id, product_id, movement_type, quantity_delta, stock_after, reason,
          reference_type, reference_id, created_at, updated_at, sync_status, version
        ) VALUES (?, ?, 'sale', ?, ?, 'Sale completed', 'sale', ?, ?, ?, ?, 1)`,
        [
          createLocalId('movement'),
          line.product.id,
          -line.quantity,
          stockAfter,
          saleId,
          now,
          now,
          SYNC_STATUS_PENDING,
        ]
      );

      recordItems.push({
        id: itemId,
        sale_id: saleId,
        product_id: line.product.id,
        barcode: line.product.barcode,
        product_name: line.product.name,
        quantity: line.quantity,
        unit_price_cents: line.unitPriceCents,
        discount_cents: line.discountCents,
        tax_cents: 0,
        total_cents: totalCents,
      });
    }

    const payments = input.payments?.length
      ? input.payments
      : [{ method: input.paymentMethod ?? 'Cash', amountCents: totals.totalCents }];
    validatePayments(
      payments.map((payment) => ({
        method: (payment.method || input.paymentMethod || 'Cash') as PaymentMethod,
        amount: fromCents(payment.amountCents ?? totals.totalCents),
        reference: payment.reference,
      })),
      fromCents(totals.totalCents)
    );

    const recordPayments: PaymentRow[] = [];
    for (const payment of payments) {
      await txn.runAsync(
        `INSERT INTO payments (
          id, sale_id, method, amount_cents, reference, created_at, updated_at, sync_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          createLocalId('payment'),
          saleId,
          payment.method,
          payment.amountCents ?? totals.totalCents,
          payment.reference ?? null,
          now,
          now,
          SYNC_STATUS_PENDING,
        ]
      );
      recordPayments.push({
        method: payment.method,
        amount_cents: payment.amountCents ?? totals.totalCents,
      });
    }

    await txn.runAsync(
      `INSERT INTO audit_logs (id, entity_type, entity_id, action, message, metadata_json, created_at)
        VALUES (?, 'sale', ?, 'create', 'Sale created transactionally', ?, ?)`,
      [createLocalId('audit'), saleId, JSON.stringify({ saleNumber }), now]
    );

    createdSale = {
      id: saleId,
      saleNumber,
      customerName: input.customerName?.trim() || undefined,
      customerPhone: input.customerPhone?.trim() || undefined,
      saleDate,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      items: recordItems,
      payments: recordPayments,
    };
  });

  if (!createdSale) {
    throw new Error('Sale transaction did not complete');
  }

  return createdSale;
};

export const importLegacySale = async (
  bill: Bill,
  db?: DbExecutor
): Promise<void> => {
  const database = await dbOrDefault(db);
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM sales WHERE id = ?',
    [bill.id]
  );
  if (existing) {
    return;
  }

  const now = nowIso();
  const subtotalCents = toCents(bill.total);
  await database.runAsync(
    `INSERT INTO sales (
      id, sale_number, customer_name, customer_phone, sale_date, subtotal_cents,
      discount_cents, tax_cents, total_cents, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 1)`,
    [
      bill.id,
      bill.id,
      bill.customerName || null,
      bill.customerPhone || null,
      bill.timestamp,
      subtotalCents,
      subtotalCents,
      now,
      now,
      SYNC_STATUS_PENDING,
    ]
  );

  for (const item of bill.items) {
    const product = await database.getFirstAsync<ProductStockRow>(
      'SELECT id, barcode, name, price_cents, stock_quantity FROM products WHERE barcode = ?',
      [item.id]
    );
    await database.runAsync(
      `INSERT INTO sale_items (
        id, sale_id, product_id, barcode, product_name, quantity, unit_price_cents,
        discount_cents, tax_cents, total_cents, created_at, updated_at, sync_status, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 1)`,
      [
        createLocalId('legacy-sale-item'),
        bill.id,
        product?.id ?? null,
        item.id,
        item.name,
        item.quantity,
        toCents(item.price),
        toCents(item.total),
        now,
        now,
        SYNC_STATUS_PENDING,
      ]
    );
  }

  await database.runAsync(
    `INSERT INTO payments (
      id, sale_id, method, amount_cents, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      createLocalId('legacy-payment'),
      bill.id,
      bill.paymentMethod || 'Cash',
      subtotalCents,
      now,
      now,
      SYNC_STATUS_PENDING,
    ]
  );
};

export const getSaleById = async (
  id: string,
  db?: DbExecutor
): Promise<SaleRecord | null> => {
  const database = await dbOrDefault(db);
  const sale = await database.getFirstAsync<SaleRow>(
    'SELECT * FROM sales WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  if (!sale) {
    return null;
  }

  const [items, payments] = await Promise.all([
    database.getAllAsync<SaleItemRow>('SELECT * FROM sale_items WHERE sale_id = ?', [id]),
    database.getAllAsync<PaymentRow>('SELECT method, amount_cents FROM payments WHERE sale_id = ?', [id]),
  ]);

  return {
    id: sale.id,
    saleNumber: sale.sale_number,
    customerName: sale.customer_name ?? undefined,
    customerPhone: sale.customer_phone ?? undefined,
    saleDate: sale.sale_date,
    subtotalCents: sale.subtotal_cents,
    discountCents: sale.discount_cents,
    taxCents: sale.tax_cents,
    totalCents: sale.total_cents,
    items,
    payments,
  };
};

export const listSalesByDateRange = async (
  startDate?: number,
  endDate?: number,
  db?: DbExecutor
): Promise<SaleRecord[]> => {
  const database = await dbOrDefault(db);
  const rows = await database.getAllAsync<SaleRow>(
    `SELECT * FROM sales
      WHERE deleted_at IS NULL
        AND (? IS NULL OR sale_date >= ?)
        AND (? IS NULL OR sale_date <= ?)
      ORDER BY sale_date DESC`,
    [startDate ?? null, startDate ?? null, endDate ?? null, endDate ?? null]
  );

  const sales: SaleRecord[] = [];
  for (const row of rows) {
    const sale = await getSaleById(row.id, database);
    if (sale) {
      sales.push(sale);
    }
  }

  return sales;
};

export const getSalesSummary = async (
  startDate?: number,
  endDate?: number,
  db?: DbExecutor
): Promise<{ totalSalesCents: number; totalBills: number; totalItems: number }> => {
  const database = await dbOrDefault(db);
  const row = await database.getFirstAsync<{
    total_sales_cents: number | null;
    total_bills: number;
    total_items: number | null;
  }>(
    `SELECT
        SUM(s.total_cents) AS total_sales_cents,
        COUNT(DISTINCT s.id) AS total_bills,
        SUM(si.quantity) AS total_items
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.deleted_at IS NULL
        AND (? IS NULL OR s.sale_date >= ?)
        AND (? IS NULL OR s.sale_date <= ?)`,
    [startDate ?? null, startDate ?? null, endDate ?? null, endDate ?? null]
  );

  return {
    totalSalesCents: row?.total_sales_cents ?? 0,
    totalBills: row?.total_bills ?? 0,
    totalItems: row?.total_items ?? 0,
  };
};

export const toLegacyBill = (sale: SaleRecord): Bill => ({
  id: sale.id,
  customerName: sale.customerName ?? '',
  customerPhone: sale.customerPhone,
  timestamp: sale.saleDate,
  paymentMethod: sale.payments[0]?.method ?? 'Cash',
  total: fromCents(sale.totalCents),
  items: sale.items.map((item) => ({
    id: item.barcode,
    name: item.product_name,
    quantity: item.quantity,
    price: fromCents(item.unit_price_cents),
    total: fromCents(item.total_cents),
  })),
});
