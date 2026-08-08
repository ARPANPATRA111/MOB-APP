import {
  TREND_DAYS,
  buildDashboardSummary,
  buildSalesTrend,
  percentChange,
} from '../dashboard';
import { fuzzySearchProducts, paginate } from '../search';
import type { Bill, InventoryItem } from '../../types';

const products: InventoryItem[] = [
  { barcode: '8901', name: 'Rice Bag', quantity: 10, price: 55, category: 'Grocery' },
  { barcode: '8902', name: 'Refined Oil', quantity: 4, price: 120, category: 'Grocery' },
  { barcode: '7777', name: 'Notebook', quantity: 12, price: 30, category: 'Stationery' },
];

/** Local-noon timestamp for `daysAgo` days before `reference`, timezone-safe. */
const localDayAt = (reference: Date, daysAgo: number) => {
  const date = new Date(reference);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
};

const billAt = (id: string, timestamp: number, total: number, quantity = 1): Bill => ({
  id,
  items: [{ id: '8901', name: 'Rice Bag', quantity, price: total / quantity, total }],
  total,
  customerName: 'Walk-in',
  timestamp,
  paymentMethod: 'Cash',
});

describe('product search and dashboard summary', () => {
  it('prioritizes exact and prefix product matches', () => {
    expect(fuzzySearchProducts(products, '8902')[0].name).toBe('Refined Oil');
    expect(fuzzySearchProducts(products, 'rice')[0].name).toBe('Rice Bag');
    expect(fuzzySearchProducts(products, 'gro')).toHaveLength(2);
  });

  it('paginates with safe minimum values', () => {
    expect(paginate(products, { page: 1, pageSize: 2 })).toHaveLength(2);
    expect(paginate(products, { page: 2, pageSize: 2 })).toEqual([products[2]]);
    expect(paginate(products, { page: 0, pageSize: 0 })).toEqual([products[0]]);
  });

  it("summarizes today's bills without counting old bills", () => {
    const now = new Date('2026-07-07T10:00:00.000Z');
    const bills: Bill[] = [
      billAt('bill-today', localDayAt(now, 0), 110, 2),
      billAt('bill-yesterday', localDayAt(now, 1), 30),
    ];

    expect(buildDashboardSummary(products, bills, [products[1]], now)).toMatchObject({
      totalProducts: 3,
      lowStockCount: 1,
      todaysBills: 1,
      revenueToday: 110,
      itemsSoldToday: 2,
      revenueYesterday: 30,
      averageBillToday: 110,
    });
  });

  it('reports revenue change against yesterday and averages per bill', () => {
    const now = new Date('2026-07-07T10:00:00.000Z');
    const bills: Bill[] = [
      billAt('a', localDayAt(now, 0), 90),
      billAt('b', localDayAt(now, 0), 60),
      billAt('c', localDayAt(now, 1), 100),
    ];

    const summary = buildDashboardSummary(products, bills, [], now);
    expect(summary.revenueToday).toBe(150);
    expect(summary.revenueYesterday).toBe(100);
    expect(summary.revenueChangePercent).toBe(50);
    expect(summary.averageBillToday).toBe(75);
  });

  it('leaves the revenue change undefined when there is no baseline to compare to', () => {
    const now = new Date('2026-07-07T10:00:00.000Z');
    const summary = buildDashboardSummary(products, [billAt('a', localDayAt(now, 0), 40)], [], now);

    expect(summary.revenueYesterday).toBe(0);
    expect(summary.revenueChangePercent).toBeNull();
    expect(percentChange(40, 0)).toBeNull();
    expect(percentChange(0, 50)).toBe(-100);
  });
});

describe('dashboard sales trend', () => {
  const now = new Date('2026-07-07T10:00:00.000Z');

  it('emits one oldest-to-newest point per day, ending today', () => {
    const trend = buildSalesTrend([], now);

    expect(trend).toHaveLength(TREND_DAYS);
    expect(trend.filter((point) => point.isToday)).toHaveLength(1);
    expect(trend[trend.length - 1].isToday).toBe(true);
    expect([...trend].sort((a, b) => a.day.localeCompare(b.day)).map((p) => p.day))
      .toEqual(trend.map((p) => p.day));
  });

  it('buckets bills into their own day and keeps quiet days as zero', () => {
    const trend = buildSalesTrend(
      [
        billAt('a', localDayAt(now, 0), 25.5),
        billAt('b', localDayAt(now, 0), 14.5),
        billAt('c', localDayAt(now, 3), 60),
      ],
      now
    );

    expect(trend[trend.length - 1]).toMatchObject({ revenue: 40, bills: 2, isToday: true });
    expect(trend[TREND_DAYS - 4]).toMatchObject({ revenue: 60, bills: 1 });
    expect(trend[0]).toMatchObject({ revenue: 0, bills: 0 });
  });

  it('ignores bills outside the window instead of folding them into an edge day', () => {
    const trend = buildSalesTrend([billAt('old', localDayAt(now, 30), 500)], now);

    expect(trend.reduce((sum, point) => sum + point.revenue, 0)).toBe(0);
  });
});
