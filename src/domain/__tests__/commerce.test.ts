import { calculateTotals, toCents } from '../money';
import {
  allocateDiscount,
  calculateSettlement,
  weightedAverageCost,
  validateQuantity,
} from '../commerce';
import { csvToProducts, productsToCsv, reviewProductsCsv } from '../backup';
import { getPeriodRange, buildSalesReportSummary } from '../reports';

describe('commerce correctness', () => {
  it('rounds decimal amounts and rejects invalid totals', () => {
    expect(toCents('1.005')).toBe(101);
    expect(() =>
      calculateTotals([{ quantity: 1, unitPriceCents: 100, discountCents: -1 }])
    ).toThrow();
    expect(() => calculateTotals([{ quantity: 1, unitPriceCents: 100 }], 101)).toThrow();
    expect(() => calculateTotals([{ quantity: 1, unitPriceCents: 100 }], NaN)).toThrow();
  });
  it('allocates discount without losing a cent', () => {
    expect(allocateDiscount([101, 101, 101], 100).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('rounds fractional-quantity line values at the half-cent boundary', () => {
    expect(calculateTotals([{quantity:1.005,unitPriceCents:100}]).totalCents).toBe(101);
    expect(calculateTotals([{quantity:0.145,unitPriceCents:100}]).totalCents).toBe(15);
    expect(calculateTotals([{quantity:1,unitPriceCents:100}],0,0.145).taxCents).toBe(15);
  });
  it('supports fractional measured quantities but not fractional pieces', () => {
    expect(validateQuantity(1.125, 'kg')).toBe(1.125);
    expect(() => validateQuantity(1.5, 'piece')).toThrow();
    expect(() => validateQuantity(0.0001, 'kg')).toThrow();
  });
  it('separates tendered cash, applied payments and credit', () => {
    expect(
      calculateSettlement(
        10000,
        [
          { method: 'Card', amountCents: 3000 },
          { method: 'Cash', amountCents: 8000 },
        ],
        false
      )
    ).toMatchObject({ paidCents: 10000, changeCents: 1000, dueCents: 0 });
    expect(calculateSettlement(10000, [{ method: 'Cash', amountCents: 2000 }], true).dueCents).toBe(
      8000
    );
    expect(() =>
      calculateSettlement(10000, [{ method: 'UPI', amountCents: 11000 }], false)
    ).toThrow();
    expect(() => calculateSettlement(10000, [], false)).toThrow();
  });
  it('does not invent costs for unknown opening stock', () => {
    expect(weightedAverageCost(10, 100, 10, 200)).toBe(150);
    expect(weightedAverageCost(10, null, 10, 200)).toBeNull();
    expect(weightedAverageCost(0, null, 10, 200)).toBe(200);
  });
  it('parses multiline CSV and reports invalid rows before importing', () => {
    const item = { barcode: 'ABC', name: 'First\nSecond', quantity: 1, price: 2 };
    expect(csvToProducts(productsToCsv([item]))[0]).toMatchObject(item);
    expect(reviewProductsCsv('barcode,name,quantity,price\nABC,Test,-2,10').errors).toHaveLength(1);
  });
  it('keeps weekly ranges within one week over month boundaries', () => {
    const range = getPeriodRange('weekly', new Date(2026, 8, 1, 12));
    expect(new Date(range.end).getMonth()).toBe(8);
    expect(new Date(range.end).getDate()).toBe(5);
  });
  it('does not combine January dates from different years', () => {
    const base = {
      id: 'x',
      saleNumber: 'x',
      subtotalCents: 100,
      discountCents: 0,
      taxCents: 0,
      totalCents: 100,
      items: [],
      payments: [],
    };
    const report = buildSalesReportSummary(
      [2025, 2026].map((year) => ({ ...base, saleDate: new Date(year, 0, 1, 12).getTime() })),
      [],
      'range'
    );
    expect(report.dailySalesTrend).toHaveLength(2);
  });
});
