import { AppText as Text } from '../../contexts/TypographyContext';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  theme: Theme;
  /** iOS button styles: filled (primary), tinted (secondary), text-only (plain), destructive. */
  variant?: 'primary' | 'secondary' | 'plain' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  compact?: boolean;
  /**
   * Called when the button is tapped while `disabled`. Lets a form explain why
   * it cannot proceed ("fill Name and Price") instead of ignoring the tap.
   */
  onDisabledPress?: () => void;
}

const foregroundFor = (theme: Theme, variant: NonNullable<Props['variant']>) => {
  if (variant === 'secondary' || variant === 'plain') return theme.primary;
  return variant === 'danger' ? '#ffffff' : theme.onPrimary;
};

const backgroundFor = (theme: Theme, variant: NonNullable<Props['variant']>) => {
  switch (variant) {
    case 'secondary':
      return theme.primarySoft;
    case 'plain':
      return 'transparent';
    case 'danger':
      return theme.dangerStrong;
    default:
      return theme.primary;
  }
};

/**
 * Disabled filled buttons keep their hue at reduced alpha — a light blue "Save"
 * reads as "not yet" while staying recognisable — rather than turning grey.
 */
const DISABLED_ALPHA = '4d'; // ≈ 30 %
const disabledBackgroundFor = (theme: Theme, variant: NonNullable<Props['variant']>) => {
  const base = backgroundFor(theme, variant);
  return variant === 'secondary' || variant === 'plain' ? base : `${base}${DISABLED_ALPHA}`;
};

const AppButton: React.FC<Props> = ({
  label,
  onPress,
  theme,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
  compact,
  onDisabledPress,
}) => {
  const fg = foregroundFor(theme, variant);
  const inactive = disabled || loading;
  // A disabled button that can explain itself stays tappable; a loading one never is.
  const explains = Boolean(disabled && !loading && onDisabledPress);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: backgroundFor(theme, variant), opacity: pressed ? 0.7 : 1 },
        disabled && !loading && { backgroundColor: disabledBackgroundFor(theme, variant) },
        disabled && !loading && (variant === 'secondary' || variant === 'plain') && { opacity: 0.4 },
        style,
      ]}
      onPress={explains ? onDisabledPress : onPress}
      disabled={inactive && !explains}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'plain' || variant === 'secondary' ? theme.primary : fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={compact ? 16 : 18} color={fg} />}
          <Text style={[styles.label, compact && styles.compactLabel, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  compact: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...typography.button },
  compactLabel: { fontSize: 13, lineHeight: 18 },
});

export default AppButton;
