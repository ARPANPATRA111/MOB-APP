import type { CommerceReport } from '../repositories/reportRepository';
import { formatCurrency } from './currency';
const escape = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
export const reportHtml = (r: CommerceReport, currency: string) => {
  const money = (n: number) => escape(formatCurrency(n, currency));
  return `<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:28px;color:#1c1c1e}h1{font-size:26px}h2{margin-top:28px;font-size:18px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}td:last-child,th:last-child{text-align:right}p{line-height:1.5;color:#555}</style></head><body><h1>Shop report</h1><p>${escape(r.label)} · ${escape(currency)}</p><table><tr><td>Total sales including tax</td><td>${money(r.totalSales)}</td></tr><tr><td>Net sales after discounts, before tax</td><td>${money(r.netSales)}</td></tr><tr><td>Tax</td><td>${money(r.tax)}</td></tr><tr><td>Bills</td><td>${r.totalBills}</td></tr><tr><td>Collections received in this period</td><td>${money(r.collections)}</td></tr><tr><td>Gross profit on cost-known items</td><td>${money(r.knownProfit)}</td></tr><tr><td>Margin on cost-known net sales</td><td>${r.knownNetSales ? ((r.knownProfit / r.knownNetSales) * 100).toFixed(1) + '%' : '—'}</td></tr></table><p>${r.missingCostLines} sale lines have unknown cost and are excluded from profit. This is gross profit before operating expenses.</p><h2>Current position at export</h2><p>Inventory value: ${money(r.inventoryValue)}. ${r.unknownCostProducts} stocked products have unknown cost. Outstanding customer credit: ${money(r.outstanding)}.</p><h2>Collections by payment method</h2><table><tr><th>Method</th><th>Payments</th><th>Collected</th></tr>${r.payments.map((p) => `<tr><td>${escape(p.method)}</td><td>${p.count}</td><td>${money(p.total)}</td></tr>`).join('')}</table><h2>Top 100 products by net sales</h2><table><tr><th>Product</th><th>Quantity</th><th>Net sales</th></tr>${r.topProductsByRevenue.map((p) => `<tr><td>${escape(p.name)}</td><td>${p.quantity}</td><td>${money(p.totalSales)}</td></tr>`).join('')}</table></body></html>`;
};
