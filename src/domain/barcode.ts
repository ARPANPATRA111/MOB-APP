/**
 * Retail barcode canonicalisation and validation.
 *
 * The camera scanners are restricted to retail 1D symbologies (EAN-13, EAN-8,
 * UPC-A, UPC-E). This module provides the shared logic to sanitise a scanned or
 * typed value, verify its check digit, and produce a canonical form so that the
 * same physical product always maps to one inventory key (e.g. a UPC-A code and
 * its zero-padded EAN-13 equivalent are treated as the same product).
 *
 * QR codes / free-text symbologies are intentionally NOT handled here — the goal
 * is to prevent arbitrary payloads (URLs, etc.) from ever becoming a product.
 */

export const RETAIL_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;
export type RetailBarcodeType = (typeof RETAIL_BARCODE_TYPES)[number];

/** Valid total lengths (including the check digit) for supported retail codes. */
const RETAIL_LENGTHS = [8, 12, 13];

export interface BarcodeClassification {
  /** The raw input, trimmed. */
  raw: string;
  /** Only the digit characters of the input. */
  digits: string;
  /** Canonical lookup key (UPC-A promoted to EAN-13). */
  canonical: string;
  /** True when length is a supported retail length. */
  isRetailLength: boolean;
  /** True when the mod-10 check digit is valid. */
  checksumValid: boolean;
  /** True when the value should prompt a confirmation before use. */
  suspicious: boolean;
  /** Human-readable reason when suspicious. */
  reason?: string;
}

/** Trim and strip everything except digits. */
export const sanitizeBarcode = (raw: string): string => (raw ?? '').replace(/\D/g, '');

/** Compute the mod-10 check digit for a payload (code without its check digit). */
const computeCheckDigit = (payload: string): number => {
  const reversed = payload.split('').reverse();
  let sum = 0;
  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number(reversed[i]);
    // The rightmost payload digit gets weight 3, then alternating 1/3.
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
};

/** Validate the EAN-8 / UPC-A / EAN-13 check digit. */
export const isChecksumValid = (code: string): boolean => {
  if (!/^\d+$/.test(code) || !RETAIL_LENGTHS.includes(code.length)) {
    return false;
  }
  const payload = code.slice(0, -1);
  const check = Number(code.slice(-1));
  return computeCheckDigit(payload) === check;
};

/**
 * Canonical lookup key. A 12-digit UPC-A is promoted to its 13-digit EAN-13
 * form (leading zero) so both scan results reference the same product. Other
 * lengths are returned unchanged.
 */
export const canonicalBarcode = (raw: string): string => {
  const digits = sanitizeBarcode(raw);
  if (digits.length === 12) {
    return `0${digits}`;
  }
  return digits;
};

/** Two barcodes refer to the same product if their canonical forms match. */
export const barcodesEquivalent = (a: string, b: string): boolean => {
  const ca = canonicalBarcode(a);
  const cb = canonicalBarcode(b);
  return ca.length > 0 && ca === cb;
};

/** Full classification used by the scanners to decide accept vs. confirm. */
export const classifyBarcode = (raw: string): BarcodeClassification => {
  const trimmed = (raw ?? '').trim();
  const digits = sanitizeBarcode(trimmed);
  const canonical = canonicalBarcode(trimmed);
  const isRetailLength = RETAIL_LENGTHS.includes(digits.length);
  const checksumValid = isChecksumValid(digits);

  let suspicious = false;
  let reason: string | undefined;

  if (digits.length === 0) {
    suspicious = true;
    reason = 'No numeric barcode detected';
  } else if (digits.length !== trimmed.length) {
    suspicious = true;
    reason = 'Barcode contains non-numeric characters';
  } else if (!isRetailLength) {
    suspicious = true;
    reason = `Unusual length (${digits.length} digits)`;
  } else if (!checksumValid) {
    suspicious = true;
    reason = 'Check digit does not match — possible misread';
  }

  return { raw: trimmed, digits, canonical, isRetailLength, checksumValid, suspicious, reason };
};

/**
 * In-store numbers for products that have no manufacturer barcode.
 *
 * GS1 reserves EAN-13 numbers starting 02 and 20–29 as Restricted Circulation
 * Numbers for use inside one company or shop; they can never clash with a real
 * product, and they print as ordinary EAN-13 stickers any scanner understands.
 */

/** GS1 modulo-10 check digit for the first 12 digits of an EAN-13. */
export const ean13CheckDigit = (twelve: string): number => {
  if (!/^\d{12}$/.test(twelve)) throw new Error('Expected 12 digits');
  return computeCheckDigit(twelve);
};

/** True for GS1 in-store / variable-measure numbers (EAN-13 starting 02 or 20–29). */
export const isInStoreCode = (code: string): boolean =>
  /^\d{13}$/.test(code) && (code.startsWith('02') || /^2[0-9]/.test(code));

/**
 * New in-store EAN-13: `20` + 10 random digits + check digit. Callers should
 * still check the catalog for a clash before saving (the odds are 1 in 10¹⁰).
 */
export const generateInStoreBarcode = (random: () => number = Math.random): string => {
  let body = '20';
  while (body.length < 12) body += Math.floor(random() * 10);
  return body + ean13CheckDigit(body);
};
