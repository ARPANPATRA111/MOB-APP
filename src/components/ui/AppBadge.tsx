import { AppText as Text } from '../../contexts/TypographyContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Theme, lightTheme } from '../../contexts/ThemeContext';

export type BadgeTone = 'neutral' | 'warning' | 'danger' | 'success';

/**
 * Status pill. Colours come from the theme rather than fixed hex, otherwise the
 * pale light-mode fills stay pale on the dark canvas and the dark label text on
 * them becomes unreadable.
 *
 * `theme` is optional only so existing call sites keep working; pass it.
 */
const AppBadge: React.FC<{ label: string; tone?: BadgeTone; theme?: Theme }> = ({
  label,
  tone = 'neutral',
  theme = lightTheme,
}) => {
  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.inputBackground, fg: theme.textSecondary },
    warning: { bg: theme.warningSoft, fg: theme.warning },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
    success: { bg: theme.successSoft, fg: theme.success },
  };
  const { bg, fg } = palette[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 12, fontWeight: '700' },
});

export default AppBadge;
