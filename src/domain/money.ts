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
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numericValue)) {
    throw new Error('Money value must be a finite number');
  }

  return Math.round(numericValue * 100);
};

export const fromCents = (value: number): number => {
  return Number((value / 100).toFixed(2));
};

export const calculateLineTotalCents = ({
  quantity,
  unitPriceCents,
  discountCents = 0,
  taxCents = 0,
}: PricedLine): number => {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Line quantity must be a positive integer');
  }

  if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('Unit price must be a non-negative cent amount');
  }

  const gross = quantity * unitPriceCents;
  const total = gross - discountCents + taxCents;
  if (total < 0) {
    throw new Error('Line total cannot be negative');
  }

  return total;
};

export const calculateTotals = (
  lines: PricedLine[],
  billDiscountCents = 0,
  taxRate = 0
): MoneyTotals => {
  if (lines.length === 0) {
    throw new Error('At least one line is required');
  }

  if (billDiscountCents < 0) {
    throw new Error('Discount cannot be negative');
  }

  if (taxRate < 0) {
    throw new Error('Tax rate cannot be negative');
  }

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents - (line.discountCents ?? 0),
    0
  );
  const effectiveSubtotal = Math.max(0, subtotalCents - billDiscountCents);
  const taxCents = Math.round(effectiveSubtotal * taxRate);
  const totalCents = effectiveSubtotal + taxCents;

  return {
    subtotalCents,
    discountCents: billDiscountCents,
    taxCents,
    totalCents,
  };
};
