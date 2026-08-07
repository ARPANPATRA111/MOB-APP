import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { cardShadow } from '../../theme/shadows';

const AppCard: React.FC<{ theme: Theme; children: React.ReactNode; style?: ViewStyle }> = ({ theme, children, style }) => (
  <View style={[createStyles(theme).card, style]}>{children}</View>
);

const createStyles = (theme: Theme) => StyleSheet.create({
  card: {
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    ...cardShadow,
  },
});

export default AppCard;
