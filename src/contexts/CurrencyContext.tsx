import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  DEFAULT_CURRENCY_CODE,
  currencySymbol,
  formatCompactNumber,
  formatCurrency,
  formatCurrencyShort,
  type FormatCurrencyOptions,
} from '../domain/currency';
import { storageService } from '../services/storage';

type CurrencyContextType = {
  /** ISO code currently configured on the business profile. */
  code: string;
  symbol: string;
  /** `₹1,234.50` — the default for money shown in full. */
  format: (value: number, options?: FormatCurrencyOptions) => string;
  /** `₹1,235` — headline figures and dense list rows. */
  formatShort: (value: number) => string;
  /** `1.2k` — symbol-free, for chart labels and other tight spots. */
  formatCompact: (value: number) => string;
  /** Re-read the profile after Settings changes the currency. */
  refresh: () => Promise<void>;
};

const fallback: CurrencyContextType = {
  code: DEFAULT_CURRENCY_CODE,
  symbol: currencySymbol(DEFAULT_CURRENCY_CODE),
  format: (value, options) => formatCurrency(value, DEFAULT_CURRENCY_CODE, options),
  formatShort: (value) => formatCurrencyShort(value, DEFAULT_CURRENCY_CODE),
  formatCompact: (value) => formatCompactNumber(value, DEFAULT_CURRENCY_CODE),
  refresh: async () => {},
};

const CurrencyContext = createContext<CurrencyContextType>(fallback);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [code, setCode] = useState(DEFAULT_CURRENCY_CODE);

  const refresh = useCallback(async () => {
    try {
      const profile = await storageService.getBusinessProfile();
      setCode(profile?.currencyCode || DEFAULT_CURRENCY_CODE);
    } catch (error) {
      // A missing/locked profile must never block rendering — money still shows,
      // just in the default currency.
      console.error('Currency load failed:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<CurrencyContextType>(
    () => ({
      code,
      symbol: currencySymbol(code),
      format: (amount, options) => formatCurrency(amount, code, options),
      formatShort: (amount) => formatCurrencyShort(amount, code),
      formatCompact: (amount) => formatCompactNumber(amount, code),
      refresh,
    }),
    [code, refresh]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = () => useContext(CurrencyContext);
