import type { Bill, InventoryItem } from '../types';

export interface SalesTrendPoint {
  /** Short axis label, e.g. "Mon". */
  label: string;
  /** `YYYY-MM-DD` in local time — stable key for lists and tests. */
  day: string;
  revenue: number;
  bills: number;
  isToday: boolean;
}

export interface DashboardSummary {
  totalProducts: number;
  lowStockCount: number;
  todaysBills: number;
  revenueToday: number;
  itemsSoldToday: number;
  /** Yesterday's revenue — the baseline the header delta is measured against. */
  revenueYesterday: number;
  /**
   * Percentage change from yesterday to today, rounded to one decimal.
   * `null` when yesterday had no sales, because "up ∞%" is not a useful stat.
   */
  revenueChangePercent: number | null;
  /** Today's revenue divided by today's bill count (0 when there are none). */
  averageBillToday: number;
  /** Oldest-to-newest revenue series ending today, for the dashboard chart. */
  salesTrend: SalesTrendPoint[];
}

/** Default width of the dashboard trend chart. */
export const TREND_DAYS = 7;

const round2 = (value: number) => Number(value.toFixed(2));

/** Local-time `YYYY-MM-DD`; `toISOString` would shift the day across timezones. */
const dayKey = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const shiftDays = (date: Date, days: number) => {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
};

const weekdayLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short' });

/**
 * Buckets bills into one point per day for the `days` days ending on `now`.
 * Days with no sales are kept as zero points so the chart keeps a stable width
 * and the x-axis stays evenly spaced.
 */
export const buildSalesTrend = (
  bills: Bill[],
  now = new Date(),
  days = TREND_DAYS
): SalesTrendPoint[] => {
  const span = Math.max(1, Math.floor(days));
  const points = new Map<string, SalesTrendPoint>();
  const today = startOfDay(now);

  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const date = shiftDays(today, -offset);
    const key = dayKey(date);
    points.set(key, {
      label: weekdayLabel(date),
      day: key,
      revenue: 0,
      bills: 0,
      isToday: offset === 0,
    });
  }

  bills.forEach((bill) => {
    const point = points.get(dayKey(new Date(bill.timestamp)));
    if (point) {
      point.revenue += bill.total;
      point.bills += 1;
    }
  });

  return Array.from(points.values()).map((point) => ({
    ...point,
    revenue: round2(point.revenue),
  }));
};

/**
 * Percent change between two periods, rounded to one decimal.
 * Returns `null` when the baseline is zero (no meaningful percentage exists).
 */
export const percentChange = (current: number, previous: number): number | null => {
  if (previous <= 0) {
    return null;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

export const buildDashboardSummary = (
  inventory: InventoryItem[],
  bills: Bill[],
  lowStock: InventoryItem[],
  now = new Date()
): DashboardSummary => {
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(shiftDays(now, -1));

  const todaysBills = bills.filter((bill) => dayKey(new Date(bill.timestamp)) === todayKey);
  const yesterdaysBills = bills.filter((bill) => dayKey(new Date(bill.timestamp)) === yesterdayKey);

  const revenueToday = round2(todaysBills.reduce((sum, bill) => sum + bill.total, 0));
  const revenueYesterday = round2(yesterdaysBills.reduce((sum, bill) => sum + bill.total, 0));

  return {
    totalProducts: inventory.length,
    lowStockCount: lowStock.length,
    todaysBills: todaysBills.length,
    revenueToday,
    itemsSoldToday: todaysBills.reduce(
      (sum, bill) => sum + bill.items.reduce((count, item) => count + item.quantity, 0),
      0
    ),
    revenueYesterday,
    revenueChangePercent: percentChange(revenueToday, revenueYesterday),
    averageBillToday: todaysBills.length ? round2(revenueToday / todaysBills.length) : 0,
    salesTrend: buildSalesTrend(bills, now),
  };
};
