import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';
import AppCard from './AppCard';

const StatCard: React.FC<{ theme: Theme; label: string; value: string; hint?: string }> = ({ theme, label, value, hint }) => (
  <AppCard theme={theme} style={styles.card}>
    <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
    <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
    {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
  </AppCard>
);

const styles = StyleSheet.create({
  card: { flex: 1, minHeight: 104 },
  label: { ...typography.caption, textTransform: 'uppercase' },
  value: { marginTop: 8, ...typography.stat },
  hint: { marginTop: 6, ...typography.caption },
});

export default StatCard;
