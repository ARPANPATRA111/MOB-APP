import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';

/**
 * Full-screen loading fallback. Paints its own themed background so it never
 * flashes the wrong colour when returned as a whole-screen body (e.g. before
 * the navigator card background is applied).
 */
const AppLoadingState: React.FC<{ theme: Theme; label?: string }> = ({ theme, label = 'Loading...' }) => (
  <View style={[styles.container, { backgroundColor: theme.background }]}>
    <ActivityIndicator color={theme.primary} size="large" />
    <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  label: {
    marginTop: 12,
    fontSize: 14,
  },
});

export default AppLoadingState;
