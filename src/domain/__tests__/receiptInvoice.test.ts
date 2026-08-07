import { createReceiptHtml, formatReceiptData } from '../receipt';
import type { SaleRecord } from '../../repositories/saleRepository';

const sale: SaleRecord = {
  id: 'sale-1',
  saleNumber: 'INV-001',
  customerName: 'Ravi Kumar',
  customerPhone: '9000000000',
  saleDate: new Date('2026-07-07T09:30:00Z').getTime(),
  subtotalCents: 25000,
  discountCents: 1000,
  taxCents: 1200,
  totalCents: 25200,
  items: [
    {
      id: 'line-1',
      sale_id: 'sale-1',
      product_id: 'product-1',
      barcode: '111',
      product_name: 'Premium Atta 10kg',
      quantity: 2,
      unit_price_cents: 12500,
      discount_cents: 1000,
      tax_cents: 1200,
      total_cents: 24000,
    },
  ],
  payments: [{ method: 'Cash', amount_cents: 25200 }],
};

describe('official invoice formatting', () => {
  it('includes business, customer, payment, totals, and item table fields', () => {
    const receipt = formatReceiptData(sale, {
      id: 'business-1',
      businessName: 'MOB Store',
      ownerName: 'Arpan Patra',
      phone: '9999999999',
      address: 'Main Road',
      gstin: '22AAAAA0000A1Z5',
      receiptFooter: 'Visit again',
      currencyCode: 'INR',
    });

    const html = createReceiptHtml(receipt);

    expect(receipt.customerPhone).toBe('9000000000');
    expect(html).toContain('INVOICE');
    expect(html).toContain('Owner: Arpan Patra');
    expect(html).toContain('GSTIN');
    expect(html).toContain('Ravi Kumar');
    expect(html).toContain('Grand Total');
    expect(html).toContain('Premium Atta 10kg');
  });
});
