import {
  CURRENCIES,
  DEFAULT_CURRENCY_CODE,
  currencySymbol,
  formatCompactNumber,
  formatCurrency,
  formatCurrencyShort,
  resolveCurrency,
} from '../currency';

describe('currency resolution', () => {
  it('falls back to the default for unknown, empty or missing codes', () => {
    expect(resolveCurrency('ZZZ').code).toBe(DEFAULT_CURRENCY_CODE);
    expect(resolveCurrency('').code).toBe(DEFAULT_CURRENCY_CODE);
    expect(resolveCurrency(null).code).toBe(DEFAULT_CURRENCY_CODE);
    expect(resolveCurrency(undefined).code).toBe(DEFAULT_CURRENCY_CODE);
  });

  it('accepts lowercase codes', () => {
    expect(resolveCurrency('usd').symbol).toBe('$');
    expect(currencySymbol('inr')).toBe('₹');
  });

  it('exposes every listed currency by its own code', () => {
    CURRENCIES.forEach((entry) => {
      expect(resolveCurrency(entry.code).code).toBe(entry.code);
    });
  });
});

describe('currency formatting', () => {
  it('groups rupees in the Indian system and dollars in thousands', () => {
    expect(formatCurrency(100000, 'INR')).toBe('₹1,00,000.00');
    expect(formatCurrency(100000, 'USD')).toBe('$100,000.00');
  });

  it('keeps two decimals by default and drops them on request', () => {
    expect(formatCurrency(1234.5, 'INR')).toBe('₹1,234.50');
    expect(formatCurrency(1234.5, 'INR', { decimals: false })).toBe('₹1,235');
    expect(formatCurrencyShort(1234.5, 'INR')).toBe('₹1,235');
  });

  it('puts the minus sign ahead of the symbol', () => {
    expect(formatCurrency(-250, 'INR')).toBe('-₹250.00');
  });

  it('renders non-finite input as zero rather than NaN', () => {
    expect(formatCurrency(Number.NaN, 'INR')).toBe('₹0.00');
    expect(formatCurrency(Number.POSITIVE_INFINITY, 'USD')).toBe('$0.00');
    expect(formatCompactNumber(Number.NaN, 'INR')).toBe('0');
  });
});

describe('compact number formatting', () => {
  it('steps rupees through k, lakh and crore', () => {
    expect(formatCompactNumber(950, 'INR')).toBe('950');
    expect(formatCompactNumber(1500, 'INR')).toBe('1.5k');
    expect(formatCompactNumber(250000, 'INR')).toBe('2.5L');
    expect(formatCompactNumber(15000000, 'INR')).toBe('1.5Cr');
  });

  it('steps other currencies through k, M and B', () => {
    expect(formatCompactNumber(1500, 'USD')).toBe('1.5k');
    expect(formatCompactNumber(2500000, 'USD')).toBe('2.5M');
    expect(formatCompactNumber(3000000000, 'USD')).toBe('3B');
  });

  it('drops the decimal once the scaled value reaches three digits', () => {
    expect(formatCompactNumber(123400, 'USD')).toBe('123k');
    expect(formatCompactNumber(12340, 'USD')).toBe('12.3k');
  });

  it('trims a trailing .0 instead of showing "1.0k"', () => {
    expect(formatCompactNumber(1000, 'USD')).toBe('1k');
    expect(formatCompactNumber(100000, 'INR')).toBe('1L');
  });
});
