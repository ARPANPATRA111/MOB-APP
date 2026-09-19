/**
 * Currency presentation.
 *
 * `money.ts` owns the arithmetic (everything is integer cents there); this
 * module owns how an amount is *shown*. Every screen must format through here
 * rather than hardcoding a symbol, so switching the business currency in
 * Settings changes the whole app at once.
 */

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  /**
   * Indian numbering groups in lakh/crore (1,00,000) rather than thousands.
   * Drives both digit grouping and the compact suffixes.
   */
  indianGrouping?: boolean;
  /** Fraction digits shown (default 2). Zero-decimal currencies pass 0. */
  decimals?: number;
}

export const DEFAULT_CURRENCY_CODE = 'INR';

/**
 * Common shop currencies worldwide. Symbols follow local convention; codes
 * without a compact symbol use the ISO code with a trailing space. Zero-decimal
 * currencies (JPY, KRW, VND…) still store cents internally but are shown whole.
 */
export const CURRENCIES: CurrencyOption[] = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', indianGrouping: true },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'AED', symbol: 'AED ', label: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR ', label: 'Saudi Riyal' },
  { code: 'QAR', symbol: 'QAR ', label: 'Qatari Riyal' },
  { code: 'KWD', symbol: 'KD ', label: 'Kuwaiti Dinar' },
  { code: 'BHD', symbol: 'BD ', label: 'Bahraini Dinar' },
  { code: 'OMR', symbol: 'OMR ', label: 'Omani Rial' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'MYR', symbol: 'RM ', label: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿', label: 'Thai Baht' },
  { code: 'IDR', symbol: 'Rp ', label: 'Indonesian Rupiah', decimals: 0 },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso' },
  { code: 'VND', symbol: '₫', label: 'Vietnamese Dong', decimals: 0 },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', decimals: 0 },
  { code: 'KRW', symbol: '₩', label: 'South Korean Won', decimals: 0 },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'HKD', symbol: 'HK$', label: 'Hong Kong Dollar' },
  { code: 'TWD', symbol: 'NT$', label: 'New Taiwan Dollar' },
  { code: 'PKR', symbol: 'Rs. ', label: 'Pakistani Rupee' },
  { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka' },
  { code: 'LKR', symbol: 'Rs. ', label: 'Sri Lankan Rupee' },
  { code: 'NPR', symbol: 'Rs. ', label: 'Nepalese Rupee' },
  { code: 'MVR', symbol: 'Rf ', label: 'Maldivian Rufiyaa' },
  { code: 'CHF', symbol: 'CHF ', label: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr ', label: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr ', label: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr ', label: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł ', label: 'Polish Zloty' },
  { code: 'CZK', symbol: 'Kč ', label: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft ', label: 'Hungarian Forint', decimals: 0 },
  { code: 'RON', symbol: 'lei ', label: 'Romanian Leu' },
  { code: 'TRY', symbol: '₺', label: 'Turkish Lira' },
  { code: 'RUB', symbol: '₽', label: 'Russian Ruble' },
  { code: 'UAH', symbol: '₴', label: 'Ukrainian Hryvnia' },
  { code: 'ILS', symbol: '₪', label: 'Israeli Shekel' },
  { code: 'EGP', symbol: 'E£', label: 'Egyptian Pound' },
  { code: 'MAD', symbol: 'MAD ', label: 'Moroccan Dirham' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', label: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh ', label: 'Kenyan Shilling' },
  { code: 'TZS', symbol: 'TSh ', label: 'Tanzanian Shilling', decimals: 0 },
  { code: 'UGX', symbol: 'USh ', label: 'Ugandan Shilling', decimals: 0 },
  { code: 'ETB', symbol: 'Br ', label: 'Ethiopian Birr' },
  { code: 'ZAR', symbol: 'R ', label: 'South African Rand' },
  { code: 'MXN', symbol: 'MX$', label: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'ARS', symbol: 'AR$', label: 'Argentine Peso' },
  { code: 'CLP', symbol: 'CLP$', label: 'Chilean Peso', decimals: 0 },
  { code: 'COP', symbol: 'COL$', label: 'Colombian Peso', decimals: 0 },
  { code: 'PEN', symbol: 'S/ ', label: 'Peruvian Sol' },
];

/** Picker label such as `₹ INR`; codes without a distinct symbol show once. */
export const currencyPickerLabel = (c: CurrencyOption): string =>
  c.symbol.trim() === c.code ? c.code : `${c.symbol.trim()} ${c.code}`;

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((entry) => [entry.code, entry]));

export const resolveCurrency = (code: string | null | undefined): CurrencyOption =>
  CURRENCY_BY_CODE.get((code ?? '').toUpperCase()) ??
  CURRENCY_BY_CODE.get(DEFAULT_CURRENCY_CODE)!;

export const currencySymbol = (code: string | null | undefined): string =>
  resolveCurrency(code).symbol;

/**
 * Groups digits. `Intl` is available under Hermes, but the locale the *device*
 * happens to use is not the locale the *currency* implies — a rupee total on a
 * US-locale phone should still group as 1,00,000. So grouping follows the
 * currency, not the device.
 */
const groupDigits = (value: number, indianGrouping: boolean, decimals: number): string =>
  Math.abs(value).toLocaleString(indianGrouping ? 'en-IN' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export interface FormatCurrencyOptions {
  /** Include paise/cents. Defaults to true — turn off for at-a-glance figures. */
  decimals?: boolean;
}

/** `formatCurrency(1234.5, 'INR')` → `₹1,234.50`. */
export const formatCurrency = (
  value: number,
  code: string | null | undefined = DEFAULT_CURRENCY_CODE,
  options: FormatCurrencyOptions = {}
): string => {
  const currency = resolveCurrency(code);
  const safeValue = Number.isFinite(value) ? value : 0;
  const decimals = options.decimals === false ? 0 : (currency.decimals ?? 2);
  const sign = safeValue < 0 ? '-' : '';
  return `${sign}${currency.symbol}${groupDigits(safeValue, Boolean(currency.indianGrouping), decimals)}`;
};

/** Decimal-free variant for headline figures and list rows. */
export const formatCurrencyShort = (
  value: number,
  code: string | null | undefined = DEFAULT_CURRENCY_CODE
): string => formatCurrency(Math.round(value), code, { decimals: false });

/**
 * Symbol-free compact form for tight spots like chart annotations.
 * Rupees step through k / L / Cr; other currencies through k / M / B.
 */
export const formatCompactNumber = (
  value: number,
  code: string | null | undefined = DEFAULT_CURRENCY_CODE
): string => {
  const currency = resolveCurrency(code);
  const safeValue = Number.isFinite(value) ? value : 0;
  const sign = safeValue < 0 ? '-' : '';
  const magnitude = Math.abs(safeValue);

  const steps: { limit: number; suffix: string }[] = currency.indianGrouping
    ? [
        { limit: 10000000, suffix: 'Cr' },
        { limit: 100000, suffix: 'L' },
        { limit: 1000, suffix: 'k' },
      ]
    : [
        { limit: 1000000000, suffix: 'B' },
        { limit: 1000000, suffix: 'M' },
        { limit: 1000, suffix: 'k' },
      ];

  for (const step of steps) {
    if (magnitude >= step.limit) {
      const scaled = magnitude / step.limit;
      // Drop the decimal once we're into 3 digits — "12.3k" is fine, "123.4k"
      // is noise at chart-label size.
      const digits = scaled >= 100 ? 0 : 1;
      return `${sign}${scaled.toFixed(digits).replace(/\.0$/, '')}${step.suffix}`;
    }
  }

  return `${sign}${Math.round(magnitude)}`;
};
