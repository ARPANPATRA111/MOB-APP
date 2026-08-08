import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

interface Props {
  label: string;
  onPress: () => void;
  theme: Theme;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * Label/spinner colour per variant. `onPrimary` is theme-aware because the dark
 * theme's primary is a light blue — white text on it fails contrast, dark text
 * passes.
 */
const foregroundFor = (theme: Theme, variant: NonNullable<Props['variant']>) => {
  if (variant === 'secondary') {
    return theme.primary;
  }
  return variant === 'danger' ? '#ffffff' : theme.onPrimary;
};

const AppButton: React.FC<Props> = ({ label, onPress, theme, variant = 'primary', disabled, loading, style }) => {
  const styles = createStyles(theme, variant);
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
    >
      {loading ? (
        <ActivityIndicator color={foregroundFor(theme, variant)} />
      ) : (
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme, variant: NonNullable<Props['variant']>) => StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: variant === 'danger' ? theme.dangerStrong : variant === 'secondary' ? theme.cardBackground : theme.primary,
    borderWidth: variant === 'secondary' ? 1 : 0,
    borderColor: theme.primary,
  },
  disabled: {
    backgroundColor: theme.disabled,
    borderColor: theme.disabled,
  },
  label: {
    color: foregroundFor(theme, variant),
    ...typography.button,
  },
});

export default AppButton;
