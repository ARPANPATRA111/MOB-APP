import type { SaleRecord } from '../repositories/saleRepository';

import type { InventoryItem } from '../types';

import { fromCents } from './money';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReportPreset = 'today' | 'last7Days' | 'thisMonth';

export interface ProductSalesSummary {
  id: string;

  name: string;

  quantity: number;

  totalSales: number;
}

export interface PaymentModeSummary {
  method: string;

  total: number;

  count: number;

  percentage: number;
}

export interface DailySalesTrendPoint {
  label: string;

  sales: number;

  bills: number;
}

export interface SalesReportSummary {
  label: string;

  totalSales: number;

  totalBills: number;

  totalItems: number;

  averageBillValue: number;

  products: ProductSalesSummary[];

  topProductsByQuantity: ProductSalesSummary[];

  topProductsByRevenue: ProductSalesSummary[];

  payments: PaymentModeSummary[];

  dailySalesTrend: DailySalesTrendPoint[];

  lowStock: InventoryItem[];
}

export const getPresetRange = (preset: ReportPreset, date = new Date()) => {
  const start = new Date(date);

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  if (preset === 'last7Days') {
    start.setDate(start.getDate() - 6);

    end.setDate(end.getDate() + 1);
  } else if (preset === 'thisMonth') {
    start.setDate(1);

    end.setMonth(start.getMonth() + 1, 1);
  } else {
    end.setDate(end.getDate() + 1);
  }

  return {
    start: start.getTime(),

    end: end.getTime() - 1,
  };
};

export const getPeriodRange = (period: ReportPeriod, date = new Date()) => {
  const start = new Date(date);

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  if (period === 'weekly') {
    start.setDate(start.getDate() - start.getDay());
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 7);
  } else if (period === 'monthly') {
    start.setDate(1);

    end.setMonth(start.getMonth() + 1, 1);
  } else if (period === 'yearly') {
    start.setMonth(0, 1);

    end.setFullYear(start.getFullYear() + 1, 0, 1);
  } else {
    end.setDate(start.getDate() + 1);
  }

  return {
    start: start.getTime(),

    end: end.getTime() - 1,
  };
};

const trendLabel = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString(undefined, {
    day: '2-digit',

    month: 'short',
  });

export const buildSalesReportSummary = (
  sales: SaleRecord[],

  lowStock: InventoryItem[],

  label: string
): SalesReportSummary => {
  const products = new Map<string, ProductSalesSummary>();

  const payments = new Map<string, { total: number; count: number }>();

  const dailyTrend = new Map<string, DailySalesTrendPoint>();

  let totalSales = 0;

  let totalItems = 0;

  sales.forEach((sale) => {
    totalSales += fromCents(sale.totalCents);

    sale.items.forEach((item) => {
      totalItems += item.quantity;

      const id = item.product_id ?? item.barcode;

      const existing = products.get(id);

      if (existing) {
        existing.quantity += item.quantity;

        existing.totalSales += fromCents(item.total_cents);
      } else {
        products.set(id, {
          id,

          name: item.product_name,

          quantity: item.quantity,

          totalSales: fromCents(item.total_cents),
        });
      }
    });

    const date = new Date(sale.saleDate);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const day = dailyTrend.get(dayKey) ?? { label: trendLabel(sale.saleDate), sales: 0, bills: 0 };
    day.sales += fromCents(sale.totalCents);

    day.bills += 1;

    dailyTrend.set(dayKey, day);

    sale.payments.forEach((payment) => {
      const current = payments.get(payment.method) ?? { total: 0, count: 0 };

      current.total += fromCents(payment.amount_cents);

      current.count += 1;

      payments.set(payment.method, current);
    });
  });

  const productList = Array.from(products.values());

  const paymentList = Array.from(payments.entries()).map(([method, value]) => ({
    method,

    total: Number(value.total.toFixed(2)),

    count: value.count,

    percentage: totalSales > 0 ? Number(((value.total / totalSales) * 100).toFixed(1)) : 0,
  }));

  return {
    label,

    totalSales: Number(totalSales.toFixed(2)),

    totalBills: sales.length,

    totalItems,

    averageBillValue: sales.length ? Number((totalSales / sales.length).toFixed(2)) : 0,

    products: productList.sort((a, b) => b.totalSales - a.totalSales),

    topProductsByQuantity: [...productList].sort((a, b) => b.quantity - a.quantity),

    topProductsByRevenue: [...productList].sort((a, b) => b.totalSales - a.totalSales),

    payments: paymentList.sort((a, b) => b.total - a.total),

    dailySalesTrend: Array.from(dailyTrend.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, point]) => ({ ...point, sales: Number(point.sales.toFixed(2)) })),
    lowStock,
  };
};
