import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  theme: Theme;
  /** Percentage change; `null` means "no baseline to compare against". */
  percent: number | null;
  /** What the change is measured against, e.g. "vs yesterday". */
  caption?: string;
  /** Copy shown when `percent` is null. */
  emptyLabel?: string;
}

/** Below this the change is noise, so it reads as "flat" rather than up/down. */
const FLAT_THRESHOLD = 0.1;

/**
 * Direction chip for a period-over-period change. Direction is carried by an
 * arrow icon and the sign as well as by colour, so it stays readable for
 * colour-blind users and in grayscale.
 */
const DeltaChip: React.FC<Props> = ({ theme, percent, caption, emptyLabel = 'No prior data' }) => {
  if (percent === null) {
    return (
      <View style={[styles.chip, { backgroundColor: theme.inputBackground }]}>
        <Text style={[styles.text, { color: theme.textSecondary }]}>{emptyLabel}</Text>
      </View>
    );
  }

  const flat = Math.abs(percent) < FLAT_THRESHOLD;
  const up = percent > 0;
  const tone = flat
    ? { fg: theme.textSecondary, bg: theme.inputBackground }
    : up
      ? { fg: theme.success, bg: theme.successSoft }
      : { fg: theme.danger, bg: theme.dangerSoft };
  const icon = flat ? 'remove' : up ? 'arrow-up' : 'arrow-down';
  const value = `${flat ? '' : up ? '+' : '−'}${Math.abs(percent).toFixed(1)}%`;

  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Ionicons name={icon} size={13} color={tone.fg} />
      <Text style={[styles.text, { color: tone.fg }]}>{value}</Text>
      {caption ? (
        <Text style={[styles.caption, { color: tone.fg }]} numberOfLines={1}>{caption}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  text: { ...typography.caption, fontSize: 12 },
  caption: { ...typography.caption, fontSize: 12, fontWeight: '500', opacity: 0.85 },
});

export default DeltaChip;
