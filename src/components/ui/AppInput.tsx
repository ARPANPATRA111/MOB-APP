import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

const AppInput: React.FC<TextInputProps & { theme: Theme }> = ({ theme, style, ...props }) => (
  <TextInput
    placeholderTextColor={theme.placeholder}
    style={[createStyles(theme).input, style]}
    {...props}
  />
);

const createStyles = (theme: Theme) => StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: theme.inputBackground,
    color: theme.text,
    ...typography.body,
    borderWidth: 1,
    borderColor: theme.divider,
  },
});

export default AppInput;
