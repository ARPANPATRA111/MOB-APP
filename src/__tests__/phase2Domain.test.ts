import { productsToCsv, csvToProducts } from '../domain/backup';
import {
  addProductToCart,
  calculateCartMoneyTotals,
  updateCartItemDiscount,
  updateCartQuantity,
} from '../domain/cart';
import { validatePayments } from '../domain/payment';
import { createReceiptHtml, formatReceiptData } from '../domain/receipt';
import { buildSalesReportSummary, getPeriodRange } from '../domain/reports';
import type { SaleRecord } from '../repositories/saleRepository';

const sale: SaleRecord = {
  id: 'sale-1',
  saleNumber: 'S-1',
  customerName: 'Asha',
  customerPhone: '9999999999',
  saleDate: new Date('2026-07-07T10:00:00Z').getTime(),
  subtotalCents: 10000,
  discountCents: 500,
  taxCents: 475,
  totalCents: 9975,
  items: [
    {
      id: 'line-1',
      sale_id: 'sale-1',
      product_id: 'product-1',
      barcode: '111',
      product_name: 'Rice <premium>',
      quantity: 2,
      unit_price_cents: 5000,
      discount_cents: 500,
      tax_cents: 0,
      total_cents: 9500,
    },
  ],
  payments: [{ method: 'UPI', amount_cents: 9975 }],
};

describe('cart workflow domain', () => {
  it('adds products, enforces stock, and calculates bill discount plus tax', () => {
    const product = { barcode: '111', name: 'Rice', price: 50, quantity: 4 };
    let cart = addProductToCart([], product);
    cart = updateCartQuantity(cart, '111', 3);
    cart = updateCartItemDiscount(cart, '111', 10);

    expect(cart[0].total).toBe(140);
    expect(calculateCartMoneyTotals(cart, 5, 0.05)).toEqual({
      subtotal: 140,
      discount: 5,
      tax: 6.75,
      total: 141.75,
    });
    expect(() => updateCartQuantity(cart, '111', 5)).toThrow('Only 4 units available');
  });
});

describe('payment validation domain', () => {
  it('accepts supported payment methods and rejects mismatched totals', () => {
    expect(() => validatePayments([{ method: 'Cash', amount: 50 }], 50)).not.toThrow();
    expect(() => validatePayments([{ method: 'UPI', amount: 40 }], 50)).toThrow('Payment total');
  });
});

describe('receipt formatting domain', () => {
  it('formats saved sales and escapes PDF receipt HTML', () => {
    const receipt = formatReceiptData(sale, {
      id: 'business-1',
      businessName: 'MOPX & Store',
      address: 'Main Road',
      phone: '9999999999',
      gstin: '22AAAAA0000A1Z5',
      receiptFooter: 'Visit again',
      currencyCode: 'INR',
    });

    expect(receipt.total).toBe(99.75);
    expect(receipt.items[0].name).toBe('Rice <premium>');
    const html = createReceiptHtml(receipt);
    expect(html).toContain('MOPX &amp; Store');
    expect(html).toContain('Rice &lt;premium&gt;');
  });
});

describe('report domain', () => {
  it('builds persisted-sale summaries by product and payment mode', () => {
    const report = buildSalesReportSummary([sale], [{ barcode: '111', name: 'Rice', quantity: 1, price: 50 }], 'daily');

    expect(report.totalSales).toBe(99.75);
    expect(report.totalBills).toBe(1);
    expect(report.totalItems).toBe(2);
    expect(report.products[0]).toMatchObject({ name: 'Rice <premium>', quantity: 2, totalSales: 95 });
    expect(report.payments[0]).toEqual({ method: 'UPI', total: 99.75, count: 1, percentage: 100 });
    expect(report.topProductsByQuantity[0].quantity).toBe(2);
    expect(report.topProductsByRevenue[0].totalSales).toBe(95);
    expect(report.dailySalesTrend[0]).toMatchObject({ sales: 99.75, bills: 1 });
    expect(report.lowStock).toHaveLength(1);
  });

  it('creates inclusive daily ranges for report queries', () => {
    const range = getPeriodRange('daily', new Date('2026-07-07T12:30:00'));
    expect(new Date(range.start).getHours()).toBe(0);
    expect(new Date(range.end).getHours()).toBe(23);
  });
});

describe('backup CSV domain', () => {
  it('round-trips product CSV safely', () => {
    const csv = productsToCsv([
      { barcode: '111', name: 'Rice, 5kg', quantity: 2, price: 50, category: 'Grocery' },
    ]);

    expect(csv).toContain('"Rice, 5kg"');
    expect(csvToProducts(csv)).toEqual([
      { barcode: '111', name: 'Rice, 5kg', quantity: 2, price: 50, category: 'Grocery', imageUri: undefined },
    ]);
  });
});
