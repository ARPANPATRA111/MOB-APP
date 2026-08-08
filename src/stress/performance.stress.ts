import { productsToCsv, csvToProducts } from '../domain/backup';
import { buildDashboardSummary } from '../domain/dashboard';
import { buildSalesReportSummary } from '../domain/reports';
import { addScannedProductToCart } from '../domain/scannerCart';
import { fuzzySearchProducts, paginate } from '../domain/search';
import type { SaleRecord } from '../repositories/saleRepository';
import type { Bill, InventoryItem } from '../types';

const now = Date.now();

const makeProducts = (count: number): InventoryItem[] => Array.from({ length: count }, (_, index) => ({
  barcode: `P${index.toString().padStart(5, '0')}`,
  name: `Product ${index}`,
  quantity: index % 11,
  price: 10 + (index % 100),
  category: index % 2 === 0 ? 'Grocery' : 'General',
}));

const makeSales = (count: number): SaleRecord[] => Array.from({ length: count }, (_, index) => ({
  id: `sale-${index}`,
  saleNumber: `S-${index}`,
  customerName: 'Walk-in',
  saleDate: now - (index % 7) * 86400000,
  subtotalCents: 10000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 10000,
  items: [
    {
      id: `line-${index}`,
      sale_id: `sale-${index}`,
      product_id: `product-${index % 100}`,
      barcode: `P${(index % 100).toString().padStart(5, '0')}`,
      product_name: `Product ${index % 100}`,
      quantity: 2,
      unit_price_cents: 5000,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: 10000,
    },
  ],
  payments: [{ method: index % 2 === 0 ? 'Cash' : 'UPI', amount_cents: 10000 }],
}));

const makeBills = (count: number): Bill[] => Array.from({ length: count }, (_, index) => ({
  id: `bill-${index}`,
  customerName: 'Walk-in',
  paymentMethod: index % 2 === 0 ? 'Cash' : 'UPI',
  timestamp: now - (index % 7) * 86400000,
  total: 100,
  items: [
    {
      id: `P${(index % 100).toString().padStart(5, '0')}`,
      name: `Product ${index % 100}`,
      quantity: 2,
      price: 50,
      total: 100,
    },
  ],
}));

describe('local stress utilities', () => {
  it('exports and parses 5000 product CSV rows within a practical local budget', () => {
    const started = Date.now();
    const products = makeProducts(5000);
    const csv = productsToCsv(products);
    const parsed = csvToProducts(csv);
    const elapsedMs = Date.now() - started;

    console.log(`CSV stress: 5000 products in ~${elapsedMs}ms, ${csv.length} chars`);
    expect(parsed).toHaveLength(5000);
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('aggregates 2000 sales with report insights within a practical local budget', () => {
    const started = Date.now();
    const report = buildSalesReportSummary(makeSales(2000), makeProducts(100).filter((item) => item.quantity <= 5), 'stress');
    const elapsedMs = Date.now() - started;

    console.log(`Report stress: 2000 sales in ~${elapsedMs}ms`);
    expect(report.totalBills).toBe(2000);
    expect(report.totalItems).toBe(4000);
    expect(report.payments).toHaveLength(2);
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('searches and paginates a large local inventory within a practical local budget', () => {
    const started = Date.now();
    const products = makeProducts(5000);
    const results = fuzzySearchProducts(products, 'product 49');
    const firstPage = paginate(results, { page: 1, pageSize: 40 });
    const elapsedMs = Date.now() - started;

    console.log(`Inventory search stress: 5000 products in ~${elapsedMs}ms`);
    expect(results.length).toBeGreaterThan(0);
    expect(firstPage.length).toBeLessThanOrEqual(40);
    expect(elapsedMs).toBeLessThan(5000);
  });

  it('builds dashboard totals and repeated scanner cart updates within a practical local budget', () => {
    const started = Date.now();
    const products = makeProducts(1000);
    const lowStock = products.filter((item) => item.quantity <= 5);
    const summary = buildDashboardSummary(products, makeBills(500), lowStock, new Date(now));
    let cart = addScannedProductToCart([], {
      barcode: products[0].barcode,
      name: products[0].name,
      price: products[0].price,
      quantity: 1000,
    }).cart;

    for (let index = 0; index < 99; index += 1) {
      cart = addScannedProductToCart(cart, {
        barcode: products[0].barcode,
        name: products[0].name,
        price: products[0].price,
        quantity: 1000,
      }).cart;
    }

    const elapsedMs = Date.now() - started;
    console.log(`Dashboard/scanner stress: 1000 products, 500 sales, 100 scans in ~${elapsedMs}ms`);
    expect(summary.totalProducts).toBe(1000);
    expect(cart[0].quantity).toBe(100);
    expect(elapsedMs).toBeLessThan(5000);
  });
});
