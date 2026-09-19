import type { BusinessProfile } from '../repositories/settingsRepository';
import type { SaleRecord } from '../repositories/saleRepository';
import { fromCents } from './money';
import { DEFAULT_CURRENCY_CODE, formatCurrency } from './currency';
import { INVOICE_BRANDING } from './branding';
export interface ReceiptLine {
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}
export interface ReceiptData {
  saleId: string;
  saleNumber: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  paymentSummary: string;
  businessName: string;
  ownerName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  gstin?: string | null;
  footerMessage?: string | null;
  /** Currency the sale was taken in, so a reprinted receipt never re-denominates. */
  currencyCode: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid?: number;
  due?: number;
  change?: number;
  dueDate?: string;
  payments?: { method: string; amount: number; date: string; reference?: string }[];
  items: ReceiptLine[];
}
export const formatReceiptData = (
  sale: SaleRecord,
  businessProfile?: BusinessProfile | null
): ReceiptData => ({
  saleId: sale.id,
  saleNumber: sale.saleNumber,
  date: new Date(sale.saleDate).toLocaleString(),
  customerName: sale.customerName || 'Walk-in',
  customerPhone: sale.customerPhone,
  paymentSummary: [...new Set(sale.payments.map((payment) => payment.method))].join(', ') || 'Credit',
  businessName: businessProfile?.businessName || 'MOPX Store',
  ownerName: businessProfile?.ownerName,
  businessAddress: businessProfile?.address,
  businessPhone: businessProfile?.phone,
  gstin: businessProfile?.gstin,
  footerMessage: businessProfile?.receiptFooter || 'Thank you for your purchase.',
  currencyCode: sale.currencyCode || businessProfile?.currencyCode || DEFAULT_CURRENCY_CODE,
  subtotal: fromCents(sale.subtotalCents),
  discount: fromCents(sale.discountCents),
  tax: fromCents(sale.taxCents),
  total: fromCents(sale.totalCents),
  paid: fromCents(sale.paidCents ?? sale.payments.reduce((sum, p) => sum + p.amount_cents, 0)),
  due: fromCents(
    sale.dueCents ??
      Math.max(0, sale.totalCents - sale.payments.reduce((sum, p) => sum + p.amount_cents, 0))
  ),
  change: fromCents(sale.changeCents ?? 0),
  dueDate: sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : undefined,
  payments: sale.payments.map((p) => ({
    method: p.method,
    amount: fromCents(p.amount_cents),
    date: new Date(p.paid_at ?? sale.saleDate).toLocaleString(),
    reference: p.reference,
  })),
  items: sale.items.map((item) => ({
    name: item.product_name,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: fromCents(item.unit_price_cents),
    discount: fromCents(item.discount_cents),
    tax: fromCents(item.tax_cents),
    total: fromCents(item.total_cents),
  })),
});
const escapeHtml = (value: string | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
/**
 * Inline SVG glyphs for the shop address and phone. The PDF is rendered by the
 * platform WebView, whose fonts do not reliably include emoji, so the icons are
 * drawn as paths and inherit the muted text colour.
 */
const ICON_STYLE = 'width:12px;height:12px;vertical-align:-2px;margin-right:4px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round';
const PIN_ICON = `<svg style="${ICON_STYLE}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>`;
const PHONE_ICON = `<svg style="${ICON_STYLE}" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>`;

export const createReceiptHtml = (receipt: ReceiptData): string => {
  const money = (value: number) => escapeHtml(formatCurrency(value, receipt.currencyCode));
  return `
  <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
        .brand h1 { margin: 0 0 6px; font-size: 24px; }
        .invoice-title { text-align: right; }
        .invoice-title h2 { margin: 0 0 6px; font-size: 20px; letter-spacing: 1px; }
        .muted { color: #4b5563; font-size: 12px; line-height: 1.45; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 18px 0; }
        .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
        .row { display: flex; justify-content: space-between; gap: 12px; margin: 6px 0; }
        .divider { border-top: 1px solid #d1d5db; margin: 14px 0; }
        .total { font-size: 18px; font-weight: 800; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; color: #111827; font-size: 12px; text-transform: uppercase; }
        th, td { padding: 9px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
        td:last-child, th:last-child { text-align: right; }
        .num { text-align: right; white-space: nowrap; }
        .summary { margin-left: auto; width: 300px; max-width: 100%; }
        .footer { margin-top: 24px; text-align: center; color: #4b5563; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <h1>${escapeHtml(receipt.businessName)}</h1>
          ${receipt.ownerName ? `<div class="muted">Owner: ${escapeHtml(receipt.ownerName)}</div>` : ''}
        ${receipt.businessAddress ? `<div class="muted">${PIN_ICON}${escapeHtml(receipt.businessAddress)}</div>` : ''}
        ${receipt.businessPhone ? `<div class="muted">${PHONE_ICON}${escapeHtml(receipt.businessPhone)}</div>` : ''}
        ${receipt.gstin ? `<div class="muted">GSTIN: ${escapeHtml(receipt.gstin)}</div>` : ''}
        </div>
        <div class="invoice-title">
          <h2>INVOICE</h2>
          <div class="muted">${escapeHtml(receipt.saleNumber)}</div>
          <div class="muted">${escapeHtml(receipt.date)}</div>
        </div>
      </div>
      <div class="meta">
        <div class="box">
          <strong>Bill To</strong>
          <div class="muted">${escapeHtml(receipt.customerName)}</div>
          ${receipt.customerPhone ? `<div class="muted">${escapeHtml(receipt.customerPhone)}</div>` : ''}
        </div>
        <div class="box">
          <strong>Payment</strong>
          <div class="muted">${escapeHtml(receipt.paymentSummary)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th class="num">Qty</th>
            <th class="num">Unit</th>
            <th class="num">Discount</th>
            <th class="num">Tax</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.items
            .map(
              (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item.name)}</td>
              <td class="num">${item.quantity} ${escapeHtml(item.unit)}</td>
              <td class="num">${money(item.unitPrice)}</td>
              <td class="num">${item.discount ? money(item.discount) : '-'}</td>
              <td class="num">${item.tax ? money(item.tax) : '-'}</td>
              <td class="num">${money(item.total)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      <div class="divider"></div>
      <div class="summary">
        <div class="row"><span>Subtotal</span><span>${money(receipt.subtotal)}</span></div>
        <div class="row"><span>Discount</span><span>${money(receipt.discount)}</span></div>
        <div class="row"><span>Tax</span><span>${money(receipt.tax)}</span></div>
        <div class="row total"><span>Grand Total</span><span>${money(receipt.total)}</span></div>
        <div class="row"><span>Paid to date</span><span>${money(receipt.paid ?? receipt.total)}</span></div>
        <div class="row"><span>Remaining balance</span><span>${money(receipt.due ?? 0)}</span></div>
        <div class="row"><span>Cash change returned</span><span>${money(receipt.change ?? 0)}</span></div>
        ${receipt.dueDate ? `<div class="row"><span>Due date</span><span>${escapeHtml(receipt.dueDate)}</span></div>` : ''}
      </div>
      <h3>Payment history</h3>
      ${(receipt.payments ?? []).map((p) => `<div class="row"><span>${escapeHtml(p.date)} &middot; ${escapeHtml(p.method)} ${escapeHtml(p.reference)}</span><span>${money(p.amount)}</span></div>`).join('')}
      <div class="footer">
        <strong>Thank you.</strong><br/>
        ${escapeHtml(receipt.footerMessage)}<br/>
        <span>${INVOICE_BRANDING}</span>
      </div>
    </body>
  </html>
`;
};
