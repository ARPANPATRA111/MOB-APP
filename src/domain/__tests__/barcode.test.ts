import {
  barcodesEquivalent,
  canonicalBarcode,
  classifyBarcode,
  isChecksumValid,
  sanitizeBarcode,
} from '../barcode';

describe('barcode sanitisation', () => {
  it('keeps only digits', () => {
    expect(sanitizeBarcode('  890 139-6381501 ')).toBe('8901396381501');
    expect(sanitizeBarcode('https://example.com')).toBe('');
  });
});

describe('EAN/UPC checksum', () => {
  it('accepts valid EAN-13 codes', () => {
    expect(isChecksumValid('4006381333931')).toBe(true);
    expect(isChecksumValid('8901396381501')).toBe(true);
  });

  it('accepts a valid UPC-A code', () => {
    expect(isChecksumValid('036000291452')).toBe(true);
  });

  it('rejects a bad check digit', () => {
    expect(isChecksumValid('4006381333932')).toBe(false);
  });

  it('rejects non-retail lengths and non-numeric input', () => {
    expect(isChecksumValid('123')).toBe(false);
    expect(isChecksumValid('12abc')).toBe(false);
    expect(isChecksumValid('')).toBe(false);
  });
});

describe('canonicalisation', () => {
  it('promotes UPC-A (12) to EAN-13 by leading zero', () => {
    expect(canonicalBarcode('036000291452')).toBe('0036000291452');
  });

  it('leaves EAN-13 and EAN-8 unchanged', () => {
    expect(canonicalBarcode('4006381333931')).toBe('4006381333931');
    expect(canonicalBarcode('96385074')).toBe('96385074');
  });

  it('treats a UPC-A and its EAN-13 form as the same product', () => {
    expect(barcodesEquivalent('036000291452', '0036000291452')).toBe(true);
    expect(barcodesEquivalent('4006381333931', '036000291452')).toBe(false);
  });
});

describe('classification', () => {
  it('accepts a clean retail barcode', () => {
    const result = classifyBarcode('4006381333931');
    expect(result.suspicious).toBe(false);
    expect(result.checksumValid).toBe(true);
    expect(result.canonical).toBe('4006381333931');
  });

  it('flags a URL / QR payload as suspicious with no digits', () => {
    const result = classifyBarcode('https://example.com/item');
    expect(result.suspicious).toBe(true);
    expect(result.digits).toBe('');
  });

  it('flags a bad check digit as suspicious but keeps the digits', () => {
    const result = classifyBarcode('4006381333932');
    expect(result.suspicious).toBe(true);
    expect(result.reason).toMatch(/check digit/i);
    expect(result.digits).toBe('4006381333932');
  });

  it('flags an unusual length', () => {
    const result = classifyBarcode('12345');
    expect(result.suspicious).toBe(true);
    expect(result.reason).toMatch(/length/i);
  });
});
