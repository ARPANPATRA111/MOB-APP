import { AppText as Text } from '../../contexts/TypographyContext';
import React from 'react';
import { DimensionValue, StyleSheet, View } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

export interface InsightBarDatum {
  label: string;
  value: number;
  caption?: string;
}

const InsightBars: React.FC<{
  theme: Theme;
  data: InsightBarDatum[];
  valueFormatter?: (value: number) => string;
}> = ({ theme, data, valueFormatter = (value) => String(value) }) => {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <View style={styles.wrap}>
      {data.map((item) => {
        const width = `${Math.max(4, (item.value / max) * 100)}%` as DimensionValue;
        return (
          <View key={item.label} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>{item.label}</Text>
              <Text style={[styles.value, { color: theme.textSecondary }]}>{valueFormatter(item.value)}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.inputBackground }]}>
              <View style={[styles.fill, { width, backgroundColor: theme.primary }]} />
            </View>
            {item.caption ? <Text style={[styles.caption, { color: theme.textSecondary }]}>{item.caption}</Text> : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { gap: 6 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { ...typography.bodyStrong, flex: 1 },
  value: typography.caption,
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
  caption: typography.caption,
});

export default InsightBars;
