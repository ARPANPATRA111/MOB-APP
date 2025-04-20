import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Appearance, ColorSchemeName, useColorScheme } from 'react-native';

// First define the interface
export interface Theme {
  mode: 'light' | 'dark';
  statusBarStyle: 'dark-content' | 'light-content';
  background: string;
  cardBackground: string;
  text: string;
  textSecondary: string;
  placeholder: string;
  primary: string;
  headerBackground: string;
  headerText: string;
  divider: string;
}

// Then create the theme objects with proper typing
export const lightTheme: Theme = {
  mode: 'light',
  divider: '#e0e0e0', // for light theme
  statusBarStyle: 'dark-content',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  placeholder: '#999999',
  primary: '#4a89dc',
  headerBackground: '#4a89dc',
  headerText: '#ffffff'
};

export const darkTheme: Theme = {
  mode: 'dark',
  divider: '#333333',
  statusBarStyle: 'light-content',
  background: '#121212',
  cardBackground: '#1e1e1e',
  text: '#ffffff',
  textSecondary: '#bbbbbb',
  placeholder: '#888888',
  primary: '#5d9cec',
  headerBackground: '#1a1a1a',
  headerText: '#ffffff'
};

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark') => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  toggleTheme: () => {},
  setTheme: () => {}
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(colorScheme === 'dark' ? darkTheme : lightTheme);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme === 'dark' ? darkTheme : lightTheme);
    });
    return () => subscription.remove();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev.mode === 'light' ? darkTheme : lightTheme);
  };

  const updateTheme = (mode: 'light' | 'dark') => {
    setTheme(mode === 'light' ? lightTheme : darkTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);