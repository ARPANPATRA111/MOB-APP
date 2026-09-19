import { assertMinorUnits, quantityCostCents, validateQuantity } from './commerce';
export interface MoneyTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}
export interface PricedLine {
  quantity: number;
  unitPriceCents: number;
  discountCents?: number;
  taxCents?: number;
}
export const toCents = (value: number | string): number => {
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text) || !Number.isFinite(Number(text)))
    throw new Error('Money value must be a finite decimal number');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  const result = Number(
    BigInt(whole) * 100n +
      BigInt((fraction + '00').slice(0, 2)) +
      (Number(fraction[2] ?? 0) >= 5 ? 1n : 0n)
  );
  assertMinorUnits(result);
  return negative ? -result : result;
};
export const fromCents = (value: number) => Number((value / 100).toFixed(2));
export const calculateLineTotalCents = ({
  quantity,
  unitPriceCents,
  discountCents = 0,
  taxCents = 0,
}: PricedLine): number => {
  validateQuantity(quantity);
  assertMinorUnits(unitPriceCents, 'Unit price');
  assertMinorUnits(discountCents, 'Discount');
  assertMinorUnits(taxCents, 'Tax');
  const gross = quantityCostCents(quantity, unitPriceCents);
  if (discountCents > gross) throw new Error('Discount cannot exceed item subtotal');
  return assertMinorUnits(gross - discountCents + taxCents);
};
export const calculateTotals = (
  lines: PricedLine[],
  billDiscountCents = 0,
  taxRate = 0
): MoneyTotals => {
  if (!lines.length) throw new Error('At least one line is required');
  assertMinorUnits(billDiscountCents, 'Discount');
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1)
    throw new Error('Tax rate must be between 0 and 100%');
  const subtotalCents = lines.reduce(
    (sum, line) => sum + calculateLineTotalCents({ ...line, taxCents: 0 }),
    0
  );
  if (billDiscountCents > subtotalCents) throw new Error('Discount cannot exceed subtotal');
  assertMinorUnits(subtotalCents,'Subtotal');
  const rateUnits=Math.round(taxRate*100000000);
  if(Math.abs(taxRate-rateUnits/100000000)>1e-12)throw new Error('Use at most six decimal places for the tax percentage');
  const taxCents=Number((BigInt(subtotalCents-billDiscountCents)*BigInt(rateUnits)+50000000n)/100000000n);
  return {
    subtotalCents,
    discountCents: billDiscountCents,
    taxCents,
    totalCents: assertMinorUnits(subtotalCents - billDiscountCents + taxCents),
  };
};
