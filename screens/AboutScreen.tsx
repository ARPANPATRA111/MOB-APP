import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { developerInfo, isAllowedDeveloperUrl } from '../src/domain/developerInfo';
import { APP_FULL_NAME, APP_MEANING } from '../src/domain/branding';
import AppCard from '../src/components/ui/AppCard';
import AppHeader from '../src/components/ui/AppHeader';
import AppScreen from '../src/components/ui/AppScreen';
import SectionHeader from '../src/components/ui/SectionHeader';
import { typography } from '../src/theme/typography';

const AboutScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const openUrl = async (url: string) => {
    try {
      if (!isAllowedDeveloperUrl(url)) {
        throw new Error('Unsupported link');
      }
      if (!(await Linking.canOpenURL(url))) {
        throw new Error('This device cannot open the link');
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Link unavailable', (error as Error).message);
    }
  };

  return (
    <AppScreen theme={theme}>
      <AppHeader theme={theme} title={`About ${APP_FULL_NAME}`} subtitle={APP_MEANING} />

      <AppCard theme={theme} style={styles.section}>
        <SectionHeader theme={theme} title="Purpose" />
        <Text style={styles.body}>
          MOPX is an offline-first retail app for small vendors and shopkeepers who need fast billing,
          inventory tracking, receipts, and local reports without depending on internet access.
        </Text>
      </AppCard>

      <AppCard theme={theme} style={styles.section}>
        <SectionHeader theme={theme} title="Developer" />
        <Text style={styles.name}>{developerInfo.name}</Text>
        <Text style={styles.body}>{developerInfo.description}</Text>
        <View style={styles.links}>
          <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(`mailto:${developerInfo.email}`)}>
            <Ionicons name="mail-outline" size={20} color={theme.primary} />
            <Text style={styles.linkText}>{developerInfo.email}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => openUrl(developerInfo.portfolio)}>
            <Ionicons name="globe-outline" size={20} color={theme.primary} />
            <Text style={styles.linkText}>arpan111.vercel.app</Text>
          </TouchableOpacity>
        </View>
      </AppCard>
    </AppScreen>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  section: { marginBottom: 12, gap: 8 },
  body: { color: theme.textSecondary, ...typography.body },
  name: { color: theme.text, ...typography.sectionTitle },
  links: { gap: 10, marginTop: 8 },
  linkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { color: theme.primary, ...typography.bodyStrong },
});

export default AboutScreen;
