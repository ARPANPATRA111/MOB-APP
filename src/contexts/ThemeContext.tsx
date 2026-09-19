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
  statusBarStyle: 'dark-content',
  // iOS system grouped palette. Canvas is the grouped background; cards are white.
  background: '#f2f2f7',
  cardBackground: '#ffffff',
  inputBackground: '#eeeef2',
  text: '#0b0b0f',
  textSecondary: '#6e6e73',
  placeholder: '#a1a1a8',
  primary: '#0a7aff',
  secondary: '#6e6e73',
  disabled: '#c7c7cc',
  headerBackground: '#f2f2f7',
  headerText: '#0b0b0f',
  divider: '#d8d8dd',
  chrome: '#f7f7fa',
  chromeBorder: '#d8d8dd',
  primarySoft: '#e3efff',
  onPrimary: '#ffffff',
  surfaceElevated: '#ffffff',
  success: '#248a3d',
  successSoft: '#e1f5e6',
  warning: '#c25e00',
  warningSoft: '#fff1dd',
  danger: '#d70015',
  dangerSoft: '#ffe5e5',
  dangerStrong: '#e5393f',
  chartGrid: '#e3e3e8',
  chartBarMuted: '#c9def7',
};
export const darkTheme: Theme = {
  mode: 'dark',
  statusBarStyle: 'light-content',
  background: '#000000',
  cardBackground: '#1c1c1e',
  inputBackground: '#2c2c2e',
  text: '#f5f5f7',
  textSecondary: '#98989f',
  placeholder: '#6b6b70',
  primary: '#3d9bff',
  secondary: '#98989f',
  disabled: '#3a3a3c',
  headerBackground: '#000000',
  headerText: '#f5f5f7',
  divider: '#2f2f33',
  chrome: '#121214',
  chromeBorder: '#2a2a2e',
  primarySoft: '#122a4a',
  onPrimary: '#ffffff',
  surfaceElevated: '#2c2c2e',
  success: '#30d158',
  successSoft: '#12291d',
  warning: '#ff9f0a',
  warningSoft: '#2d2413',
  danger: '#ff453a',
  dangerSoft: '#2f1a1a',
  dangerStrong: '#d32f2f',
  chartGrid: '#2a2a2e',
  chartBarMuted: '#233a5c',
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
    void loadStoredTheme().catch(() => {});
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
    void storageService.saveThemePreference(mode).catch(() => {});
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
