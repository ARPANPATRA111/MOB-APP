import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import { storageService } from '../services/storage';

// First define the interface
export interface Theme {
  mode: 'light' | 'dark';
  statusBarStyle: 'dark-content' | 'light-content';
  background: string;
  cardBackground: string;
  inputBackground: string;
  text: string;
  textSecondary: string;
  placeholder: string;
  primary: string;
  secondary: string;
  disabled: string;
  headerBackground: string;
  headerText: string;
  divider: string;

  /**
   * App chrome — the single background shared by the navigation header, the
   * bottom action bar and the OS status/navigation bar areas. Keeping these on
   * one token is what makes the top and bottom of every screen read as one
   * continuous surface instead of three stacked strips.
   */
  chrome: string;
  /** Hairline used to separate chrome from scrolling content. */
  chromeBorder: string;
  /** Low-emphasis tint of `primary`, for icon wells, chips and selected pills. */
  primarySoft: string;
  /** Text/icon colour that is legible on top of `primary`. */
  onPrimary: string;
  /** Slightly raised surface used for hero/metric panels above `cardBackground`. */
  surfaceElevated: string;

  // Theme-aware status colours. The flat values in `theme/colors.ts` are tuned
  // for light backgrounds only and wash out badly on the dark canvas.
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  /**
   * Fill for destructive buttons. Deliberately deeper than `danger` (which is
   * tuned to be *readable as text* on the canvas) so white button labels clear
   * WCAG AA against it in both themes.
   */
  dangerStrong: string;

  /** Baseline/gridline colour for in-app charts. */
  chartGrid: string;
  /** Fill for non-highlighted chart bars. */
  chartBarMuted: string;
}

// Then create the theme objects with proper typing
export const lightTheme: Theme = {
  mode: 'light',
  divider: '#e3e8ef', // for light theme
  statusBarStyle: 'dark-content',
  background: '#f4f6fa',
  cardBackground: '#ffffff',
  inputBackground: '#eef1f6',
  text: '#111827',
  textSecondary: '#5b6472',
  placeholder: '#9aa3b2',
  primary: '#2563eb',
  secondary: '#64748b',
  disabled: '#d7dde6',
  headerBackground: '#f4f6fa',
  headerText: '#111827',

  chrome: '#f4f6fa',
  chromeBorder: '#e3e8ef',
  primarySoft: '#e6edfd',
  onPrimary: '#ffffff',
  surfaceElevated: '#ffffff',

  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  dangerStrong: '#dc2626',

  chartGrid: '#e3e8ef',
  chartBarMuted: '#cbd9f6',
};

export const darkTheme: Theme = {
  mode: 'dark',
  divider: '#272e3a',
  statusBarStyle: 'light-content',
  background: '#0f1116',
  cardBackground: '#181b22',
  inputBackground: '#212633',
  text: '#f2f5f9',
  textSecondary: '#9aa4b5',
  placeholder: '#6b7484',
  primary: '#60a5fa',
  secondary: '#4f5b66',
  disabled: '#2a303a',
  headerBackground: '#0f1116',
  headerText: '#f2f5f9',

  chrome: '#0f1116',
  chromeBorder: '#272e3a',
  primarySoft: '#1a2740',
  onPrimary: '#0b1220',
  surfaceElevated: '#1d212a',

  success: '#4ade80',
  successSoft: '#12291d',
  warning: '#fbbf24',
  warningSoft: '#2d2413',
  danger: '#f87171',
  dangerSoft: '#2f1a1a',
  dangerStrong: '#b91c1c',

  chartGrid: '#272e3a',
  chartBarMuted: '#26344f',
};

/**
 * Theme preference model:
 * - `system`: follow the device colour scheme (default).
 * - `light` / `dark`: explicit user override.
 * The user can always return to `system`.
 */
export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextType = {
  /** Resolved theme (mode is always 'light' | 'dark'). */
  theme: Theme;
  /** The stored preference, including 'system'. */
  themeMode: ThemeMode;
  /** True once the persisted preference has been loaded (splash gating). */
  isReady: boolean;
  /** Toggle between light and dark (leaves system mode). */
  toggleTheme: () => void;
  /** Back-compat alias for setThemeMode. */
  setTheme: (mode: ThemeMode) => void;
  /** Set the explicit preference (system | light | dark) and persist it. */
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  themeMode: 'system',
  isReady: false,
  toggleTheme: () => {},
  setTheme: () => {},
  setThemeMode: () => {},
});

export const resolveTheme = (
  mode: ThemeMode,
  systemScheme: ColorSchemeName
): Theme => {
  const effective = mode === 'system' ? systemScheme : mode;
  return effective === 'dark' ? darkTheme : lightTheme;
};

/** Normalise any persisted value (including legacy null) into a ThemeMode. */
export const normalizeThemeMode = (stored: string | null | undefined): ThemeMode => {
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStoredTheme = async () => {
      try {
        const stored = await storageService.getThemePreference();
        if (!isMounted) {
          return;
        }
        setThemeModeState(normalizeThemeMode(stored));
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    void loadStoredTheme();

    return () => {
      isMounted = false;
    };
  }, []);

  const theme = useMemo(
    () => resolveTheme(themeMode, systemScheme),
    [themeMode, systemScheme]
  );

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void storageService.saveThemePreference(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(theme.mode === 'light' ? 'dark' : 'light');
  }, [setThemeMode, theme.mode]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      themeMode,
      isReady,
      toggleTheme,
      setTheme: setThemeMode,
      setThemeMode,
    }),
    [theme, themeMode, isReady, toggleTheme, setThemeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
