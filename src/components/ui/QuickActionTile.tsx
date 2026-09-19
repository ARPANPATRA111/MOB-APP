import { AppText as Text } from '../../contexts/TypographyContext';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  /** Optional count rendered as a pill (low-stock alerts, unread items). */
  badge?: number;
  badgeTone?: 'warning' | 'danger' | 'neutral';
  onPress: () => void;
}

/**
 * Square-ish navigation tile for the dashboard action grid. The whole tile is
 * one touch target (well over the 44dp minimum) rather than just the icon.
 */
const QuickActionTile: React.FC<Props> = ({
  theme,
  icon,
  label,
  hint,
  badge,
  badgeTone = 'neutral',
  onPress,
}) => {
  const badgeColors = {
    warning: { bg: theme.warningSoft, fg: theme.warning },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
    neutral: { bg: theme.primarySoft, fg: theme.primary },
  }[badgeTone];

  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: theme.cardBackground, borderColor: theme.divider }]}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityHint={hint}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWell, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name={icon} size={20} color={theme.primary} />
        </View>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors.fg }]}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>{label}</Text>
      {hint ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]} numberOfLines={1}>{hint}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: 'center',
  },
  badgeText: { ...typography.caption, fontSize: 11, fontWeight: '800' },
  label: { ...typography.bodyStrong, marginTop: 12 },
  hint: { ...typography.caption, fontWeight: '500', marginTop: 2 },
});

export default QuickActionTile;
