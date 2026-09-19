import { getDatabase, inTransaction, type DbExecutor } from '../db/database';

import { fromCents } from '../domain/money';

import type { SalesReportSummary } from '../domain/reports';

import { listLowStockProducts } from './inventoryRepository';

import type { DashboardSummary } from '../domain/dashboard';

import { percentChange } from '../domain/dashboard';

export interface CommerceReport extends SalesReportSummary {
  netSales: number;
  tax: number;
  discounts: number;
  knownProfit: number;
  knownCost: number;
  knownNetSales: number;
  missingCostLines: number;
  inventoryValue: number;
  unknownCostProducts: number;
  outstanding: number;
  collections: number;
}

export const getReport = async (
  start: number,
  end: number,
  label: string,
  db?: DbExecutor
): Promise<CommerceReport> =>
  inTransaction(async (d) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
      throw new Error('Start date must be before end date');

    const bounds = [start, end];

    const totals = await d.getFirstAsync<{
      total: number;
      net: number;
      tax: number;
      discount: number;
      bills: number;
    }>(
      `SELECT COALESCE(SUM(total_cents),0) AS total,COALESCE(SUM(subtotal_cents-discount_cents),0) AS net,COALESCE(SUM(tax_cents),0) AS tax,COALESCE(SUM(discount_cents),0) AS discount,COUNT(*) AS bills FROM sales WHERE deleted_at IS NULL AND sale_date BETWEEN ? AND ?`,
      bounds
    );

    const costs = await d.getFirstAsync<{
      cost: number;
      known_net: number;
      missing: number;
      quantity: number;
    }>(
      `SELECT COALESCE(SUM(i.cost_total_cents),0) AS cost,COALESCE(SUM(CASE WHEN i.cost_total_cents IS NOT NULL THEN i.net_cents ELSE 0 END),0) AS known_net,COALESCE(SUM(CASE WHEN i.cost_total_cents IS NULL THEN 1 ELSE 0 END),0) AS missing,COALESCE(SUM(i.quantity),0) AS quantity FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.deleted_at IS NULL AND s.sale_date BETWEEN ? AND ?`,
      bounds
    );

    const productRows = await d.getAllAsync<{
      id: string;
      name: string;
      quantity: number;
      net: number;
    }>(
      `SELECT COALESCE(i.product_id,i.barcode) AS id,i.product_name AS name,SUM(i.quantity) AS quantity,SUM(i.net_cents) AS net FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.deleted_at IS NULL AND s.sale_date BETWEEN ? AND ? GROUP BY COALESCE(i.product_id,i.barcode) ORDER BY net DESC LIMIT 100`,
      bounds
    );

    const quantityRows = await d.getAllAsync<{
      id: string;
      name: string;
      quantity: number;
      net: number;
    }>(
      `SELECT COALESCE(i.product_id,i.barcode) AS id,i.product_name AS name,SUM(i.quantity) AS quantity,SUM(i.net_cents) AS net FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.deleted_at IS NULL AND s.sale_date BETWEEN ? AND ? GROUP BY COALESCE(i.product_id,i.barcode) ORDER BY quantity DESC LIMIT 100`,
      bounds
    );

    const payments = await d.getAllAsync<{ method: string; total: number; count: number }>(
      `SELECT p.method,SUM(p.amount_cents) AS total,COUNT(*) AS count FROM payments p JOIN sales s ON s.id=p.sale_id WHERE s.deleted_at IS NULL AND p.paid_at BETWEEN ? AND ? GROUP BY p.method ORDER BY total DESC`,
      bounds
    );

    const days = await d.getAllAsync<{ day: string; sales: number; bills: number }>(
      `SELECT date(sale_date/1000,'unixepoch','localtime') AS day,SUM(total_cents) AS sales,COUNT(*) AS bills FROM sales WHERE deleted_at IS NULL AND sale_date BETWEEN ? AND ? GROUP BY day ORDER BY day`,
      bounds
    );

    const inventory = await d.getFirstAsync<{ value: number; unknown: number }>(
      `SELECT COALESCE(SUM(ROUND(ROUND(stock_quantity*1000)*cost_cents/1000.0)),0) AS value,COALESCE(SUM(CASE WHEN cost_cents IS NULL AND stock_quantity>0 THEN 1 ELSE 0 END),0) AS unknown FROM products WHERE deleted_at IS NULL`
    );

    const credit = await d.getFirstAsync<{ due: number }>(
      `SELECT COALESCE(SUM(MAX(0,total_cents-COALESCE((SELECT SUM(amount_cents) FROM payments WHERE sale_id=s.id),0))),0) AS due FROM sales s WHERE deleted_at IS NULL`
    );

    const low = await listLowStockProducts(d);
    const total = fromCents(totals?.total ?? 0);
    const collected = payments.reduce((sum, p) => sum + p.total, 0);
    const products = productRows.map((p) => ({ ...p, totalSales: fromCents(p.net) }));

    const trend = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const dayMap = new Map(days.map((p) => [p.day, p]));

    // Bound chart points. Long ranges still have exact SQL totals; show the latest 366 days.

    if ((end - start) / 86400000 > 366) {
      cursor.setTime(end);
      cursor.setDate(cursor.getDate() - 365);
      cursor.setHours(0, 0, 0, 0);
    }

    while (cursor.getTime() <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const point = dayMap.get(key);
      trend.push({ label: key, sales: fromCents(point?.sales ?? 0), bills: point?.bills ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      label,
      totalSales: total,
      totalBills: totals?.bills ?? 0,
      totalItems: costs?.quantity ?? 0,
      averageBillValue: totals?.bills ? Number((total / totals.bills).toFixed(2)) : 0,
      products,
      topProductsByRevenue: products,
      topProductsByQuantity: quantityRows.map((p) => ({ ...p, totalSales: fromCents(p.net) })),
      payments: payments.map((p) => ({
        ...p,
        total: fromCents(p.total),
        percentage: collected ? Math.round((p.total / collected) * 1000) / 10 : 0,
      })),
      dailySalesTrend: trend,
      lowStock: low.map((p) => ({
        barcode: p.barcode,
        name: p.name,
        quantity: p.quantity,
        price: 0,
      })),
      netSales: fromCents(totals?.net ?? 0),
      tax: fromCents(totals?.tax ?? 0),
      discounts: fromCents(totals?.discount ?? 0),
      knownProfit: fromCents((costs?.known_net ?? 0) - (costs?.cost ?? 0)),
      knownCost: fromCents(costs?.cost ?? 0),
      knownNetSales: fromCents(costs?.known_net ?? 0),
      missingCostLines: costs?.missing ?? 0,
      inventoryValue: fromCents(inventory?.value ?? 0),
      unknownCostProducts: inventory?.unknown ?? 0,
      outstanding: fromCents(credit?.due ?? 0),
      collections: fromCents(collected),
    };
  }, db);

export const getDashboardSummary = async (db?: DbExecutor): Promise<DashboardSummary> => {
  const d = db ?? (await getDatabase());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 6);

  const rows = await d.getAllAsync<{ day: string; revenue: number; bills: number }>(
    `SELECT date(sale_date/1000,'unixepoch','localtime') AS day,SUM(total_cents) AS revenue,COUNT(*) AS bills FROM sales WHERE deleted_at IS NULL AND sale_date>=? GROUP BY day ORDER BY day`,
    [week.getTime()]
  );

  const counts = await d.getFirstAsync<{ products: number; low: number }>(
    `SELECT COUNT(*) AS products,COALESCE(SUM(CASE WHEN stock_quantity<=low_stock_threshold THEN 1 ELSE 0 END),0) AS low FROM products WHERE deleted_at IS NULL`
  );

  const quantity = await d.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(SUM(i.quantity),0) AS n FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.deleted_at IS NULL AND s.sale_date>=?`,
    [today.getTime()]
  );

  const salesTrend = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(week);
    date.setDate(date.getDate() + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const row = rows.find((r) => r.day === key);
    salesTrend.push({
      day: key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      revenue: fromCents(row?.revenue ?? 0),
      bills: row?.bills ?? 0,
      isToday: i === 6,
    });
  }

  const current = salesTrend[6],
    previous = salesTrend[5];
  return {
    totalProducts: counts?.products ?? 0,
    lowStockCount: counts?.low ?? 0,
    todaysBills: current.bills,
    revenueToday: current.revenue,
    itemsSoldToday: quantity?.n ?? 0,
    revenueYesterday: previous.revenue,
    revenueChangePercent: percentChange(current.revenue, previous.revenue),
    averageBillToday: current.bills ? current.revenue / current.bills : 0,
    salesTrend,
  };
};
