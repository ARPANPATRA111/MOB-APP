export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Mixed'] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export const isPaymentMethod = (value: string): value is PaymentMethod => {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
};

export const validatePayments = (payments: PaymentEntry[], total: number): void => {
  if (payments.length === 0) {
    throw new Error('At least one payment is required');
  }

  const sum = payments.reduce((current, payment) => {
    if (!isPaymentMethod(payment.method)) {
      throw new Error(`Unsupported payment method: ${payment.method}`);
    }

    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    return current + payment.amount;
  }, 0);

  if (Math.round(sum * 100) !== Math.round(total * 100)) {
    throw new Error('Payment total must equal sale total');
  }
};
