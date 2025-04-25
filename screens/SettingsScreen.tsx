// SettingsScreen.tsx

import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme, lightTheme, darkTheme } from '../src/contexts/ThemeContext';
import { RootStackParamList } from '../App';

type SettingsScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Settings'>;
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        
        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Dark Mode</Text>
          <Switch
            value={theme.mode === 'dark'}
            onValueChange={toggleTheme}
            thumbColor={theme.primary}
            trackColor={{ false: theme.cardBackground, true: theme.primary }}
          />
        </View>

        <View style={styles.settingOptions}>
          <TouchableOpacity
            style={[styles.themeOption, theme.mode === 'light' && styles.themeOptionActive]}
            onPress={() => setTheme('light')}
          >
            <View style={[styles.themePreview, { backgroundColor: lightTheme.background }]}>
              <View style={[styles.themePreviewCard, { backgroundColor: lightTheme.cardBackground }]} />
            </View>
            <Text style={styles.themeOptionText}>Light</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.themeOption, theme.mode === 'dark' && styles.themeOptionActive]}
            onPress={() => setTheme('dark')}
          >
            <View style={[styles.themePreview, { backgroundColor: darkTheme.background }]}>
              <View style={[styles.themePreviewCard, { backgroundColor: darkTheme.cardBackground }]} />
            </View>
            <Text style={styles.themeOptionText}>Dark</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>MOB-App v1.0.0</Text>
        <Text style={styles.aboutText}>Mobile Point of Sale System</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: typeof lightTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 15,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBackground,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBackground,
  },
  settingText: {
    fontSize: 16,
    color: theme.text,
  },
  settingOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  themeOption: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themeOptionActive: {
    borderColor: theme.primary,
  },
  themePreview: {
    width: 80,
    height: 60,
    borderRadius: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 10,
    marginBottom: 5,
  },
  themePreviewCard: {
    width: '100%',
    height: 20,
    borderRadius: 3,
  },
  themeOptionText: {
    color: theme.text,
    fontSize: 14,
  },
  aboutText: {
    color: theme.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
});

export default SettingsScreen;