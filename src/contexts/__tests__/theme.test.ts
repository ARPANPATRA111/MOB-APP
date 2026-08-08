/* eslint-disable import/first, @typescript-eslint/no-require-imports */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  darkTheme,
  lightTheme,
  normalizeThemeMode,
  resolveTheme,
} from '../ThemeContext';

describe('theme mode resolution', () => {
  it('follows the system scheme when mode is system', () => {
    expect(resolveTheme('system', 'dark')).toBe(darkTheme);
    expect(resolveTheme('system', 'light')).toBe(lightTheme);
    // Unknown/undefined system scheme falls back to light.
    expect(resolveTheme('system', null)).toBe(lightTheme);
    expect(resolveTheme('system', undefined)).toBe(lightTheme);
  });

  it('honours an explicit override regardless of system scheme', () => {
    expect(resolveTheme('dark', 'light')).toBe(darkTheme);
    expect(resolveTheme('light', 'dark')).toBe(lightTheme);
  });

  it('normalises persisted preferences, treating legacy null as system', () => {
    expect(normalizeThemeMode('system')).toBe('system');
    expect(normalizeThemeMode('light')).toBe('light');
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode(null)).toBe('system');
    expect(normalizeThemeMode(undefined)).toBe('system');
    expect(normalizeThemeMode('garbage')).toBe('system');
  });
});
