export const PRODUCT_UNITS = ['piece', 'pack', 'box', 'kg', 'g', 'litre', 'ml', 'metre'] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];
export const validateQuantity = (value: number, unit = 'kg', allowZero = false): number => {
  if (
    !Number.isFinite(value) ||
    value < (allowZero ? 0 : 0.001) ||
    value > 1e9 ||
    Math.abs(value * 1000 - Math.round(value * 1000)) > 0.00001
  )
    throw new Error('Quantity must be positive with at most 3 decimal places');
  if (['piece', 'pack', 'box'].includes(unit) && !Number.isInteger(value))
    throw new Error(`${unit} quantities must be whole numbers`);
  return value;
};
export const assertMinorUnits = (value: number, label = 'Amount'): number => {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1e12)
    throw new Error(`${label} must be a valid non-negative amount`);
  return value;
};
/** Quantities have three decimal places; integer arithmetic avoids 1.005 * 100 rounding down. */
export const quantityCostCents = (quantity:number, cents:number):number => {
  validateQuantity(quantity,'kg',true);assertMinorUnits(cents);
  return assertMinorUnits(Number((BigInt(Math.round(quantity*1000))*BigInt(cents)+500n)/1000n));
};
export const allocateDiscount = (gross: number[], discount: number): number[] => {
  assertMinorUnits(discount, 'Discount');
  const sum = gross.reduce((a, b) => a + assertMinorUnits(b), 0);
  if (discount > sum) throw new Error('Discount cannot exceed subtotal');
  assertMinorUnits(sum,'Subtotal');
  const shares = gross.map((value) => (sum ? Number(BigInt(discount)*BigInt(value)/BigInt(sum)) : 0));
  let left = discount - shares.reduce((a, b) => a + b, 0);
  const order = gross
    .map((value, i) => ({ i, fraction: sum ? Number(BigInt(discount)*BigInt(value)%BigInt(sum)) : 0 }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const entry of order) {
    if (left > 0 && shares[entry.i] < gross[entry.i]) {
      shares[entry.i]++;
      left--;
    }
  }
  return shares;
};
export interface Tender {
  method: string;
  amountCents: number;
  reference?: string;
}
export const calculateSettlement = (total: number, tenders: Tender[], allowCredit: boolean) => {
  assertMinorUnits(total);
  let nonCash = 0;
  let cash = 0;
  for (const tender of tenders) {
    assertMinorUnits(tender.amountCents);
    if (!['Cash', 'UPI', 'Card', 'Bank'].includes(tender.method) || tender.amountCents <= 0)
      throw new Error('Enter a positive payment and a supported method');
    if (tender.method === 'Cash') cash += tender.amountCents;
    else nonCash += tender.amountCents;
  }
  assertMinorUnits(cash+nonCash,'Total tendered');
  if (nonCash > total) throw new Error('Non-cash payment cannot exceed the balance');
  const paidCents = Math.min(total, nonCash + cash);
  const dueCents = total - paidCents;
  if (dueCents > 0 && !allowCredit)
    throw new Error('Payment total must equal sale total. Enable credit to leave a balance.');
  const changeCents = Math.max(0, cash + nonCash - total);
  let cashRemaining = total - nonCash;
  const payments = tenders
    .map((tender) => {
      const applied =
        tender.method === 'Cash' ? Math.min(cashRemaining, tender.amountCents) : tender.amountCents;
      if (tender.method === 'Cash') cashRemaining -= applied;
      return { ...tender, tenderedCents: tender.amountCents, amountCents: applied };
    })
    .filter((tender) => tender.amountCents > 0);
  return { paidCents, dueCents, changeCents, payments };
};
export const weightedAverageCost = (
  stock: number,
  cost: number | null,
  added: number,
  addedCost: number
): number | null => {
  validateQuantity(stock, 'kg', true);
  validateQuantity(added);
  assertMinorUnits(addedCost, 'Cost');
  if (stock > 0 && cost === null) return null;
  assertMinorUnits(cost??0,'Existing cost');
  const oldQuantity=BigInt(Math.round(stock*1000));const newQuantity=BigInt(Math.round(added*1000));
  const total=oldQuantity+newQuantity;
  return Number((oldQuantity*BigInt(cost??0)+newQuantity*BigInt(addedCost)+total/2n)/total);
};
