import { AppText as Text } from '../../contexts/TypographyContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

const SectionHeader: React.FC<{
  theme: Theme;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ theme, title, subtitle, right }) => (
  <View style={styles.wrap}>
    <View style={styles.copy}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  copy: { flex: 1 },
  title: typography.sectionTitle,
  subtitle: { ...typography.caption, marginTop: 2 },
});

export default SectionHeader;
