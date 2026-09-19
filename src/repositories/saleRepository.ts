import type { Bill } from '../types';

import { calculateCartTotals } from '../domain/billing';

import { quantityCostCents, allocateDiscount, calculateSettlement, validateQuantity } from '../domain/commerce';

import { fromCents, toCents } from '../domain/money';

import { getDatabase, inTransaction, type DbExecutor } from '../db/database';

import { createLocalId, nowIso } from '../db/schema';

import { getBusinessProfile, type BusinessProfile } from './settingsRepository';

import { createStockMovement } from './inventoryRepository';

interface ProductStockRow {
  id: string;
  barcode: string;
  name: string;
  price_cents: number;
  stock_quantity: number;
  cost_cents: number | null;
  unit: string;
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
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  saleDate?: number;
  paymentMethod?: string;
  items: SaleLineInput[];
  payments?: PaymentInput[];
  billDiscountCents?: number;
  taxRate?: number;
  allowCredit?: boolean;
  dueDate?: number;
  draftId?: string;
}

export interface SaleItemRow {
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
  unit?: string;
  unit_cost_cents?: number | null;
  cost_total_cents?: number | null;
  net_cents?: number;
}

export interface PaymentRow {
  id?: string;
  method: string;
  amount_cents: number;
  paid_at?: number;
  reference?: string;
  tendered_cents?: number;
}

export interface SaleRecord {
  id: string;
  saleNumber: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  saleDate: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  currencyCode?: string;
  seller?: BusinessProfile | null;
  dueDate?: number;
  changeCents?: number;
  paidCents?: number;
  dueCents?: number;
  items: SaleItemRow[];
  payments: PaymentRow[];
}

interface SaleRow {
  id: string;
  sale_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  sale_date: number;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency_code: string;
  seller_json: string | null;
  due_date: number | null;
  change_cents: number;
  paid_cents?: number;
}

const dbOrDefault = async (db?: DbExecutor) => db ?? (await getDatabase());

const fromRow = (s: SaleRow, items: SaleItemRow[], payments: PaymentRow[]): SaleRecord => {
  const paid = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  let seller = null;
  try {
    seller = s.seller_json ? JSON.parse(s.seller_json) : null;
  } catch {}

  return {
    id: s.id,
    saleNumber: s.sale_number,
    customerId: s.customer_id,
    customerName: s.customer_name ?? undefined,
    customerPhone: s.customer_phone ?? undefined,
    saleDate: s.sale_date,
    subtotalCents: s.subtotal_cents,
    discountCents: s.discount_cents,
    taxCents: s.tax_cents,
    totalCents: s.total_cents,
    currencyCode: s.currency_code,
    seller,
    dueDate: s.due_date ?? undefined,
    changeCents: s.change_cents,
    paidCents: paid,
    dueCents: Math.max(0, s.total_cents - paid),
    items,
    payments,
  };
};

export const getSaleById = async (id: string, db?: DbExecutor): Promise<SaleRecord | null> => {
  const d = await dbOrDefault(db);
  const sale = await d.getFirstAsync<SaleRow>(
    'SELECT * FROM sales WHERE id=? AND deleted_at IS NULL',
    [id]
  );
  if (!sale) return null;

  const items = await d.getAllAsync<SaleItemRow>(
    'SELECT * FROM sale_items WHERE sale_id=? ORDER BY rowid',
    [id]
  );

  const payments = await d.getAllAsync<PaymentRow>(
    'SELECT * FROM payments WHERE sale_id=? ORDER BY paid_at,rowid',
    [id]
  );

  return fromRow(sale, items, payments);
};

const resolveCustomer = async (input: CreateSaleInput, txn: DbExecutor): Promise<string | null> => {
  if (input.customerId) {
    const existing = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM customers WHERE id=? AND deleted_at IS NULL',
      [input.customerId]
    );
    if (!existing) throw new Error('Customer not found');
    return existing.id;
  }

  if (!input.customerName?.trim()) return null;

  const phone = input.customerPhone?.trim();
  if (phone) {
    const existing = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM customers WHERE phone=? AND deleted_at IS NULL',
      [phone]
    );
    if (existing) return existing.id;
  }

  const id = createLocalId('customer');
  await txn.runAsync(
    'INSERT INTO customers(id,name,phone,created_at,updated_at) VALUES(?,?,?,?,?)',
    [id, input.customerName.trim(), phone ?? null, nowIso(), nowIso()]
  );
  return id;
};

export const createSaleTransaction = async (
  input: CreateSaleInput,
  db?: DbExecutor
): Promise<SaleRecord> =>
  inTransaction(async (txn) => {
    const id = input.id ?? createLocalId('sale');
    const existing = await getSaleById(id, txn);
    if (existing) return existing;

    if (!Array.isArray(input.items) || input.items.length > 200)
      throw new Error('A bill supports at most 200 products');

    const resolved = [];
    const seen = new Set<string>();

    for (const item of input.items) {
      const p = await txn.getFirstAsync<ProductStockRow>(
        `SELECT * FROM products WHERE deleted_at IS NULL AND ${item.productId ? 'id' : 'barcode'}=?`,
        [item.productId ?? item.barcode ?? '']
      );

      if (!p) throw new Error('Product no longer available. Review the cart.');

      if (seen.has(p.id)) throw new Error('Duplicate product in cart');
      seen.add(p.id);
      validateQuantity(item.quantity, p.unit ?? 'piece');

      resolved.push({
        p,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents ?? p.price_cents,
        discountCents: item.discountCents ?? 0,
      });
    }

    const totals = calculateCartTotals(
      resolved.map((l) => ({
        productId: l.p.id,
        barcode: l.p.barcode,
        name: l.p.name,
        quantity: l.quantity,
        availableStock: l.p.stock_quantity,
        unitPriceCents: l.unitPriceCents,
        discountCents: l.discountCents,
      })),
      input.billDiscountCents ?? 0,
      input.taxRate ?? 0
    );

    const tenders =
      input.payments !== undefined
        ? input.payments.map((p) => ({ ...p, amountCents: p.amountCents ?? totals.totalCents }))
        : totals.totalCents > 0
          ? [{ method: input.paymentMethod ?? 'Cash', amountCents: totals.totalCents }]
          : [];

    const settlement = calculateSettlement(totals.totalCents, tenders, Boolean(input.allowCredit));

    if (settlement.dueCents > 0 && !input.customerName?.trim())
      throw new Error('A customer name is required for credit');

    if (input.dueDate !== undefined && (!Number.isSafeInteger(input.dueDate) || input.dueDate < 0))
      throw new Error('Invalid due date');

    const customerId = await resolveCustomer(input, txn);
    const profile = (await getBusinessProfile(txn)) ?? {
      id: 'business-local',
      businessName: 'MOPX Store',
      currencyCode: 'INR',
    };
    const date = input.saleDate ?? Date.now();
    const now = nowIso();

    const number =
      input.saleNumber ??
      `M-${new Date(date).toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(-8).toUpperCase()}`;

    await txn.runAsync(
      `INSERT INTO sales(id,sale_number,customer_id,customer_name,customer_phone,sale_date,subtotal_cents,discount_cents,tax_cents,total_cents,currency_code,seller_json,due_date,change_cents,payment_status,created_at,updated_at,sync_status,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',1)`,
      [
        id,
        number,
        customerId,
        input.customerName?.trim() || null,
        input.customerPhone?.trim() || null,
        date,
        totals.subtotalCents,
        totals.discountCents,
        totals.taxCents,
        totals.totalCents,
        profile?.currencyCode ?? 'INR',
        JSON.stringify(profile),
        input.dueDate ?? null,
        settlement.changeCents,
        settlement.dueCents === 0 ? 'paid' : settlement.paidCents > 0 ? 'partial' : 'unpaid',
        now,
        now,
      ]
    );

    const gross = resolved.map((l) => quantityCostCents(l.quantity, l.unitPriceCents) - l.discountCents);
    const discounts = allocateDiscount(gross, totals.discountCents);
    const taxShares = allocateDiscount(
      gross.map((v, i) => v - discounts[i]),
      Math.min(totals.taxCents, totals.subtotalCents - totals.discountCents)
    );

    for (let i = 0; i < resolved.length; i++) {
      const l = resolved[i];
      const net = gross[i] - discounts[i];

      await txn.runAsync(
        `INSERT INTO sale_items(id,sale_id,product_id,barcode,product_name,quantity,unit_price_cents,discount_cents,tax_cents,total_cents,unit,unit_cost_cents,cost_total_cents,net_cents,created_at,updated_at,sync_status,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',1)`,
        [
          createLocalId('line'),
          id,
          l.p.id,
          l.p.barcode,
          l.p.name,
          l.quantity,
          l.unitPriceCents,
          l.discountCents + discounts[i],
          taxShares[i],
          net + taxShares[i],
          l.p.unit ?? 'piece',
          l.p.cost_cents ?? null,
          l.p.cost_cents == null ? null : quantityCostCents(l.quantity, l.p.cost_cents),
          net,
          now,
          now,
        ]
      );

      await createStockMovement(
        {
          productId: l.p.id,
          quantityDelta: -l.quantity,
          movementType: 'sale',
          reason: 'Sale completed',
          referenceType: 'sale',
          referenceId: id,
        },
        txn
      );
    }

    for (const payment of settlement.payments)
      await txn.runAsync(
        `INSERT INTO payments(id,sale_id,method,amount_cents,reference,paid_at,tendered_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
        [
          createLocalId('payment'),
          id,
          payment.method,
          payment.amountCents,
          payment.reference ?? null,
          date,
          payment.tenderedCents,
          now,
          now,
        ]
      );

    await txn.runAsync(
      `INSERT INTO audit_logs(id,entity_type,entity_id,action,message,created_at) VALUES(?,'sale',?,'create','Sale completed',?)`,
      [createLocalId('audit'), id, now]
    );

    if (input.draftId) await txn.runAsync('DELETE FROM bill_drafts WHERE id=?', [input.draftId]);

    return (await getSaleById(id, txn))!;
  }, db);

export const listSalesByDateRange = async (
  startDate?: number,
  endDate?: number,
  db?: DbExecutor
): Promise<SaleRecord[]> => {
  const d = await dbOrDefault(db);
  const where = ['deleted_at IS NULL'];
  const params: number[] = [];
  if (startDate !== undefined) {
    where.push('sale_date>=?');
    params.push(startDate);
  }
  if (endDate !== undefined) {
    where.push('sale_date<=?');
    params.push(endDate);
  }

  const rows = await d.getAllAsync<SaleRow>(
    `SELECT * FROM sales WHERE ${where.join(' AND ')} ORDER BY sale_date DESC LIMIT 500`,
    params
  );
  if (!rows.length) return [];

  const keys = rows.map((r) => r.id);
  const placeholders = keys.map(() => '?').join(',');

  const items = await d.getAllAsync<SaleItemRow>(
    `SELECT * FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY rowid`,
    keys
  );

  const payments = await d.getAllAsync<PaymentRow & { sale_id: string }>(
    `SELECT * FROM payments WHERE sale_id IN (${placeholders}) ORDER BY paid_at,rowid`,
    keys
  );

  const itemMap = new Map<string, SaleItemRow[]>();
  const paymentMap = new Map<string, PaymentRow[]>();

  items.forEach((item) => itemMap.set(item.sale_id, [...(itemMap.get(item.sale_id) ?? []), item]));
  payments.forEach((p) => paymentMap.set(p.sale_id, [...(paymentMap.get(p.sale_id) ?? []), p]));

  return rows.map((r) => fromRow(r, itemMap.get(r.id) ?? [], paymentMap.get(r.id) ?? []));
};

export const getSalesSummary = async (startDate?: number, endDate?: number, db?: DbExecutor) => {
  const d = await dbOrDefault(db);
  const params = [startDate ?? 0, endDate ?? Number.MAX_SAFE_INTEGER];

  const row = await d.getFirstAsync<{ totalSalesCents: number; totalBills: number }>(
    `SELECT COALESCE(SUM(total_cents),0) AS totalSalesCents,COUNT(*) AS totalBills FROM sales WHERE deleted_at IS NULL AND sale_date>=? AND sale_date<=?`,
    params
  );

  const items = await d.getFirstAsync<{ totalItems: number }>(
    `SELECT COALESCE(SUM(i.quantity),0) AS totalItems FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.deleted_at IS NULL AND s.sale_date>=? AND s.sale_date<=?`,
    params
  );

  return {
    totalSalesCents: row?.totalSalesCents ?? 0,
    totalBills: row?.totalBills ?? 0,
    totalItems: items?.totalItems ?? 0,
  };
};

export interface SaleHeader {
  id: string;
  sale_number: string;
  customer_name: string;
  customer_phone: string;
  sale_date: number;
  total_cents: number;
  currency_code: string;
  due_cents: number;
}

export const searchReceipts = async (
  query = '',
  before?: { date: number; id: string },
  db?: DbExecutor,
  filter?: { start?: number; end?: number; productId?: string }
): Promise<SaleHeader[]> => {
  const q = '%' + query.trim().replace(/[\\%_]/g, '\\$&') + '%';
  const params: (string | number)[] = [q, q, q];
  let cursor = '';
  if (before) {
    cursor = ' AND (s.sale_date<? OR (s.sale_date=? AND s.id<?))';
    params.push(before.date, before.date, before.id);
  }

  if (filter?.start !== undefined) {
    cursor += ' AND s.sale_date>=?';
    params.push(filter.start);
  }

  if (filter?.end !== undefined) {
    cursor += ' AND s.sale_date<=?';
    params.push(filter.end);
  }

  if (filter?.productId) {
    cursor +=
      ' AND EXISTS(SELECT 1 FROM sale_items i WHERE i.sale_id=s.id AND (i.product_id=? OR i.barcode=?))';
    params.push(filter.productId, filter.productId);
  }

  return (await dbOrDefault(db)).getAllAsync<SaleHeader>(
    `SELECT s.id,s.sale_number,s.customer_name,s.customer_phone,s.sale_date,s.total_cents,s.currency_code,MAX(0,s.total_cents-COALESCE((SELECT SUM(amount_cents) FROM payments WHERE sale_id=s.id),0)) AS due_cents FROM sales s WHERE s.deleted_at IS NULL AND (s.sale_number LIKE ? ESCAPE '\\' OR s.customer_name LIKE ? ESCAPE '\\' OR s.customer_phone LIKE ? ESCAPE '\\')${cursor} ORDER BY s.sale_date DESC,s.id DESC LIMIT 40`,
    params
  );
};

export const toLegacyBill = (sale: SaleRecord): Bill => ({
  id: sale.id,
  customerName: sale.customerName ?? '',
  customerPhone: sale.customerPhone,
  timestamp: sale.saleDate,
  paymentMethod: sale.payments.length > 1 ? 'Mixed' : (sale.payments[0]?.method ?? 'Credit'),
  total: fromCents(sale.totalCents),
  subtotal: fromCents(sale.subtotalCents),
  discount: fromCents(sale.discountCents),
  tax: fromCents(sale.taxCents),
  currencyCode: sale.currencyCode,
  dueCents: sale.dueCents,
  items: sale.items.map((i) => ({
    id: i.barcode,
    name: i.product_name,
    quantity: i.quantity,
    price: fromCents(i.unit_price_cents),
    total: fromCents(i.total_cents),
  })),
});

/** Import preserves the recorded bill and never changes stock a second time. */

export const importLegacySale = async (bill: Bill, db?: DbExecutor): Promise<void> =>
  inTransaction(async (database) => {
    if (await database.getFirstAsync('SELECT id FROM sales WHERE id=?', [bill.id])) return;

    const now = nowIso();
    const total = toCents(bill.total);
    const profile = await getBusinessProfile(database);

    await database.runAsync(
      `INSERT INTO sales(id,sale_number,customer_name,customer_phone,sale_date,subtotal_cents,discount_cents,tax_cents,total_cents,currency_code,seller_json,created_at,updated_at) VALUES(?,?,?,?,?,?,0,0,?,?,?,?,?)`,
      [
        bill.id,
        bill.id,
        bill.customerName || null,
        bill.customerPhone || null,
        bill.timestamp,
        total,
        total,
        profile?.currencyCode ?? 'INR',
        JSON.stringify(profile),
        now,
        now,
      ]
    );

    for (const item of bill.items) {
      const product = await database.getFirstAsync<{ id: string }>(
        'SELECT id FROM products WHERE barcode=?',
        [item.id]
      );

      await database.runAsync(
        `INSERT INTO sale_items(id,sale_id,product_id,barcode,product_name,quantity,unit_price_cents,total_cents,net_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [
          createLocalId('legacy-line'),
          bill.id,
          product?.id ?? null,
          item.id,
          item.name,
          item.quantity,
          toCents(item.price),
          toCents(item.total),
          toCents(item.total),
          now,
          now,
        ]
      );
    }

    await database.runAsync(
      `INSERT INTO payments(id,sale_id,method,amount_cents,tendered_cents,paid_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
      [
        createLocalId('legacy-payment'),
        bill.id,
        bill.paymentMethod || 'Cash',
        total,
        total,
        bill.timestamp,
        now,
        now,
      ]
    );
  }, db);
