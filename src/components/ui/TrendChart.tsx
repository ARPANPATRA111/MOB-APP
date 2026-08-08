import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

export interface TrendChartPoint {
  /** Axis label under the column. */
  label: string;
  /** Stable key (also used for the accessibility description). */
  key: string;
  value: number;
  /** Renders the column in the accent colour and bolds its label. */
  highlighted?: boolean;
}

interface Props {
  theme: Theme;
  data: TrendChartPoint[];
  /** Plot height in dp, excluding the axis labels. */
  height?: number;
  valueFormatter?: (value: number) => string;
  /** Screen-reader summary; falls back to a generated one. */
  accessibilityLabel?: string;
}

/** Height of a zero/near-zero column, so quiet days still read as a data point. */
const MIN_BAR_HEIGHT = 3;

/**
 * Compact column chart for short series (7-14 points), built from plain views —
 * no charting or SVG dependency. The peak column is annotated with its value so
 * the chart carries a readable number rather than being purely decorative.
 */
const TrendChart: React.FC<Props> = ({
  theme,
  data,
  height = 96,
  valueFormatter = (value) => String(value),
  accessibilityLabel,
}) => {
  const max = Math.max(...data.map((point) => point.value), 0);
  const peakKey = max > 0 ? data.find((point) => point.value === max)?.key : undefined;

  const summary =
    accessibilityLabel ??
    data.map((point) => `${point.label} ${valueFormatter(point.value)}`).join(', ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={[styles.plot, { height }]}>
        {/* Baseline sits behind the columns so every bar shares one visual floor. */}
        <View style={[styles.baseline, { backgroundColor: theme.chartGrid }]} />
        {data.map((point) => {
          const ratio = max > 0 ? point.value / max : 0;
          const barHeight = Math.max(MIN_BAR_HEIGHT, Math.round(ratio * (height - 4)));
          const isPeak = point.key === peakKey;
          return (
            <View key={point.key} style={styles.column}>
              {isPeak ? (
                <Text style={[styles.peakValue, { color: theme.textSecondary }]} numberOfLines={1}>
                  {valueFormatter(point.value)}
                </Text>
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: point.highlighted ? theme.primary : theme.chartBarMuted,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        {data.map((point) => (
          <Text
            key={point.key}
            numberOfLines={1}
            style={[
              styles.axisLabel,
              { color: point.highlighted ? theme.text : theme.textSecondary },
              point.highlighted && styles.axisLabelActive,
            ]}
          >
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  peakValue: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 3,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  axis: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  axisLabel: {
    ...typography.caption,
    fontSize: 11,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  axisLabelActive: { fontWeight: '800' },
});

export default TrendChart;
