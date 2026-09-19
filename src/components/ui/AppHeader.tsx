import { AppText as Text } from '../../contexts/TypographyContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

const AppHeader: React.FC<{
  theme: Theme;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ theme, title, subtitle, right }) => (
  <View style={styles.header}>
    <View style={styles.copy}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  copy: { flex: 1 },
  title: typography.screenTitle,
  subtitle: { ...typography.body, marginTop: 2 },
});

export default AppHeader;
