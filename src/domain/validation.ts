import { toCents } from './money';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ProductInput {
  barcode: string;
  name: string;
  price: number | string;
  quantity: number | string;
}

export const normalizeBarcode = (barcode: string): string => {
  return barcode.trim();
};

export const normalizeName = (name: string): string => {
  return name.trim().replace(/\s+/g, ' ');
};

export const parsePositiveInteger = (value: number | string, fieldName: string): number => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return numericValue;
};

export const validateProductInput = (input: ProductInput): ValidationResult => {
  const errors: string[] = [];

  if (!normalizeBarcode(input.barcode)) {
    errors.push('Barcode is required');
  }

  if (!normalizeName(input.name)) {
    errors.push('Product name is required');
  }

  try {
    parsePositiveInteger(input.quantity, 'Quantity');
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    const cents = toCents(input.price);
    if (cents <= 0) {
      errors.push('Price must be greater than zero');
    }
  } catch (error) {
    errors.push((error as Error).message);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
