// ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { Theme, lightTheme, useTheme } from './src/contexts/ThemeContext';

interface Props {
  children: ReactNode;

  theme: Theme;
}

interface State {
  hasError: boolean;

  error: Error | null;
}

class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { hasError: false, error: null };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    const theme = this.props.theme ?? lightTheme;

    if (this.state.hasError) {
      return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <Text style={[styles.header, { color: theme.mode === 'dark' ? '#ff6b6b' : '#c62828' }]}>
            Something went wrong
          </Text>

          <Text style={[styles.message, { color: theme.textSecondary }]}>
            The app hit an unexpected state. You can retry this screen without closing the app.
          </Text>

          {__DEV__ && (
            <Text style={[styles.errorText, { color: theme.text }]}>
              {this.state.error?.toString()}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}

            onPress={this.handleRetry}
          >
            <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper injects the active theme so the fallback UI is theme-aware.

// The class component still performs the actual error catching.

const ErrorBoundary = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();

  return <ErrorBoundaryInner theme={theme}>{children}</ErrorBoundaryInner>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

    justifyContent: 'center',

    alignItems: 'center',

    padding: 20,
  },

  header: {
    fontSize: 20,

    fontWeight: 'bold',

    marginBottom: 10,
  },

  message: {
    fontSize: 15,

    textAlign: 'center',

    marginBottom: 12,
  },

  errorText: {
    fontSize: 16,

    textAlign: 'center',

    marginBottom: 20,
  },

  retryButton: {
    borderRadius: 8,

    paddingHorizontal: 18,

    paddingVertical: 12,
  },

  retryButtonText: {
    color: '#ffffff',

    fontWeight: 'bold',
  },
});

export default ErrorBoundary;
