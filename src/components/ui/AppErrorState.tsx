import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

const AppErrorState: React.FC<{ theme: Theme; title: string; message?: string }> = ({ theme, title, message }) => (
  <View style={styles.container}>
    <Ionicons name="alert-circle-outline" size={32} color="#dc2626" />
    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
    {message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.sectionTitle, marginTop: 8, textAlign: 'center' },
  message: { ...typography.body, marginTop: 6, textAlign: 'center' },
});

export default AppErrorState;
