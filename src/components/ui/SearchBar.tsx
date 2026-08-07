import React from 'react';
import { StyleSheet, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../contexts/ThemeContext';
import AppInput from './AppInput';

const SearchBar: React.FC<TextInputProps & { theme: Theme }> = ({ theme, style, ...props }) => (
  <View style={[styles.wrap, { backgroundColor: theme.inputBackground, borderColor: theme.divider }, style]}>
    <Ionicons name="search" size={18} color={theme.textSecondary} />
    <AppInput theme={theme} style={styles.input} {...props} />
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});

export default SearchBar;
