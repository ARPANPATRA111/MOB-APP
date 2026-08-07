import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';

const AppEmptyState: React.FC<{ theme: Theme; title: string; message?: string }> = ({ theme, title, message }) => (
  <View style={styles.container}>
    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
    {message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default AppEmptyState;
