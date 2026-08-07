import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Updates from 'expo-updates';
import { useTheme, lightTheme, darkTheme, type Theme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { storageService } from '../src/services/storage';
import { CURRENCIES, DEFAULT_CURRENCY_CODE } from '../src/domain/currency';
import type { BusinessProfile } from '../src/repositories/settingsRepository';
import { developerInfo, isAllowedDeveloperUrl } from '../src/domain/developerInfo';
import { APP_NAME, APP_FULL_NAME } from '../src/domain/branding';
import AppButton from '../src/components/ui/AppButton';
import AppCard from '../src/components/ui/AppCard';
import AppInput from '../src/components/ui/AppInput';
import AppLoadingState from '../src/components/ui/AppLoadingState';
import AppScreen from '../src/components/ui/AppScreen';
import { useToast } from '../src/components/ui/ToastProvider';
import { useDialog } from '../src/components/ui/DialogProvider';

const emptyProfile: Partial<BusinessProfile> = {
  businessName: '',
  ownerName: '',
  phone: '',
  address: '',
  gstin: '',
  receiptFooter: 'Thank you for your purchase.',
  currencyCode: DEFAULT_CURRENCY_CODE,
};

const SettingsScreen: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const currency = useCurrency();
  const toast = useToast();
  const dialog = useDialog();
  const styles = createStyles(theme);
  const [profile, setProfile] = useState<Partial<BusinessProfile>>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '2.0.0';
  // The build number lives in the native project and is owned by EAS remotely,
  // so app config cannot report it accurately. The update runtime version is
  // what actually determines which OTA updates this build accepts.
  const runtimeVersion = Updates.runtimeVersion ?? appVersion;
  const updateChannel = Updates.channel || 'local';
  const updateId = Updates.updateId ?? 'bundled/local';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const savedProfile = await storageService.getBusinessProfile();
        setProfile(savedProfile ?? emptyProfile);
      } catch (error) {
        console.error('Profile load failed:', error);
        void dialog.alert({ title: 'Settings unavailable', message: 'Unable to load business profile settings.' });
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, [dialog]);

  const updateField = (key: keyof BusinessProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const baseDirectory = () => FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

  const shareFile = async (uri: string, title: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { dialogTitle: title });
      return;
    }
    toast.showToast({ message: `Saved to ${uri}`, variant: 'info', duration: 3200 });
  };

  const openDeveloperUrl = async (url: string) => {
    try {
      if (!isAllowedDeveloperUrl(url)) {
        throw new Error('Unsupported link');
      }
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error('This device cannot open the link');
      }
      await Linking.openURL(url);
    } catch (error) {
      void dialog.alert({ title: 'Link unavailable', message: (error as Error).message });
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await storageService.saveBusinessProfile(profile);
      // Re-read the currency so every screen re-renders in the new symbol
      // without needing an app restart.
      await currency.refresh();
      toast.showToast({ message: 'Business profile saved', variant: 'success' });
    } catch (error) {
      void dialog.alert({ title: 'Save failed', message: (error as Error).message });
    } finally {
      setSavingProfile(false);
    }
  };

  const exportJsonBackup = async () => {
    setExportingJson(true);
    try {
      const directory = baseDirectory();
      if (!directory) {
        throw new Error('Device storage is unavailable');
      }
      const backup = await storageService.buildBackupSnapshot();
      const fileUri = `${directory}mopx-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2));
      await shareFile(fileUri, 'Share MOPX backup');
      toast.showToast({ message: 'Backup exported', variant: 'success' });
    } catch (error) {
      void dialog.alert({ title: 'Backup failed', message: (error as Error).message });
    } finally {
      setExportingJson(false);
    }
  };

  const exportProductsCsv = async () => {
    setExportingCsv(true);
    try {
      const directory = baseDirectory();
      if (!directory) {
        throw new Error('Device storage is unavailable');
      }
      const csv = await storageService.exportProductsCsv();
      const fileUri = `${directory}mopx-products-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      await shareFile(fileUri, 'Share product CSV');
      toast.showToast({ message: 'Product CSV exported', variant: 'success' });
    } catch (error) {
      void dialog.alert({ title: 'CSV export failed', message: (error as Error).message });
    } finally {
      setExportingCsv(false);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        toast.showToast({ message: 'MOPX is up to date', variant: 'info' });
        return;
      }

      await Updates.fetchUpdateAsync();
      const restart = await dialog.confirm({
        title: 'Update ready',
        message: 'Restart MOPX to apply the downloaded update.',
        confirmText: 'Restart',
        cancelText: 'Later',
      });
      if (restart) {
        await Updates.reloadAsync();
      }
    } catch (error) {
      void dialog.alert({ title: 'Update check unavailable', message: (error as Error).message });
    } finally {
      setCheckingUpdates(false);
    }
  };

  if (loading) {
    return <AppLoadingState theme={theme} label="Loading settings..." />;
  }

  return (
    <AppScreen theme={theme}>
      <Text style={styles.subtitle}>Developer, business profile, app theme, and offline backups</Text>

      <AppCard theme={theme} style={styles.section}>
        <Text style={styles.sectionTitle}>Developer info</Text>
        <Text style={styles.description}>{developerInfo.description}</Text>
        <InfoRow label="Name" value={developerInfo.name} theme={theme} />
        <TouchableOpacity style={choiceStyles.infoRow} onPress={() => openDeveloperUrl(`mailto:${developerInfo.email}`)}>
          <Text style={{ color: theme.textSecondary }}>Email</Text>
          <Text style={{ color: theme.primary, fontWeight: '800' }}>{developerInfo.email}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={choiceStyles.infoRow} onPress={() => openDeveloperUrl(developerInfo.portfolio)}>
          <Text style={{ color: theme.textSecondary }}>Portfolio</Text>
          <Text style={{ color: theme.primary, fontWeight: '800' }}>arpan111.vercel.app</Text>
        </TouchableOpacity>
      </AppCard>

      <AppCard theme={theme} style={styles.section}>
        <Text style={styles.sectionTitle}>Business profile</Text>
        <AppInput theme={theme} placeholder="Business name" value={profile.businessName ?? ''} onChangeText={(value) => updateField('businessName', value)} />
        <AppInput theme={theme} placeholder="Owner name" value={profile.ownerName ?? ''} onChangeText={(value) => updateField('ownerName', value)} />
        <AppInput theme={theme} placeholder="Phone" keyboardType="phone-pad" value={profile.phone ?? ''} onChangeText={(value) => updateField('phone', value)} />
        <AppInput theme={theme} placeholder="Address" multiline value={profile.address ?? ''} onChangeText={(value) => updateField('address', value)} />
        <AppInput theme={theme} placeholder="GSTIN (optional)" autoCapitalize="characters" value={profile.gstin ?? ''} onChangeText={(value) => updateField('gstin', value)} />
        <AppInput theme={theme} placeholder="Receipt footer" value={profile.receiptFooter ?? ''} onChangeText={(value) => updateField('receiptFooter', value)} />

        <View>
          <Text style={styles.fieldLabel}>Currency</Text>
          <Text style={styles.fieldHint}>
            Applies to every amount in the app, plus printed receipts and exported reports.
          </Text>
          <View style={styles.currencyGrid}>
            {CURRENCIES.map((option) => {
              const active = (profile.currencyCode ?? DEFAULT_CURRENCY_CODE) === option.code;
              return (
                <TouchableOpacity
                  key={option.code}
                  style={[
                    styles.currencyChip,
                    active && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => updateField('currencyCode', option.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${option.label} (${option.code})`}
                >
                  <Text
                    style={[styles.currencyChipText, active && { color: theme.onPrimary }]}
                    numberOfLines={1}
                  >
                    {option.symbol.trim()} {option.code}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <AppButton theme={theme} label="Save Profile" onPress={saveProfile} loading={savingProfile} />
      </AppCard>

      <AppCard theme={theme} style={styles.section}>
        <View style={styles.settingTextBlock}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.description}>
            System follows your phone&apos;s theme. Choose Light or Dark to override. Stored as a lightweight preference, not business data.
          </Text>
        </View>
        <View style={styles.themeOptions}>
          <ThemeChoice label="System" active={themeMode === 'system'} colors={theme} onPress={() => setThemeMode('system')} />
          <ThemeChoice label="Light" active={themeMode === 'light'} colors={lightTheme} onPress={() => setThemeMode('light')} />
          <ThemeChoice label="Dark" active={themeMode === 'dark'} colors={darkTheme} onPress={() => setThemeMode('dark')} />
        </View>
      </AppCard>

      <AppCard theme={theme} style={styles.section}>
        <Text style={styles.sectionTitle}>Backup your data</Text>
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={18} color={theme.warning} />
          <Text style={styles.warningText}>
            Your shop data is stored only on this phone. There is no automatic cloud backup — if you
            lose, reset or change this phone, everything is gone unless you have exported a backup.
          </Text>
        </View>
        <Text style={styles.description}>
          Export a JSON backup regularly and keep it somewhere safe (email it to yourself, or save it
          to Drive). JSON restores everything; CSV is for opening your product list in Excel.
        </Text>
        <View style={styles.buttonRow}>
          <AppButton theme={theme} label="JSON Backup" onPress={exportJsonBackup} loading={exportingJson} style={styles.halfButton} />
          <AppButton theme={theme} label="Product CSV" onPress={exportProductsCsv} loading={exportingCsv} variant="secondary" style={styles.halfButton} />
        </View>
      </AppCard>

      <AppCard theme={theme} style={styles.section}>
        <Text style={styles.sectionTitle}>App info</Text>
        <InfoRow label="Name" value={APP_NAME} theme={theme} />
        <InfoRow label="Product" value={APP_FULL_NAME} theme={theme} />
        <InfoRow label="Version" value={appVersion} theme={theme} />
        <InfoRow label="Update runtime" value={String(runtimeVersion)} theme={theme} />
        <InfoRow label="Update channel" value={updateChannel} theme={theme} />
        <InfoRow label="Last update patch" value={updateId} theme={theme} />
        <InfoRow label="Database migration" value="003_performance_indexes" theme={theme} />
        <InfoRow label="Legacy migration" value="Checked safely at startup" theme={theme} />
        <InfoRow label="Storage" value="SQLite local database" theme={theme} />
        <InfoRow label="Sync" value="Not enabled" theme={theme} />
        <AppButton theme={theme} label="Check for Updates" onPress={checkForUpdates} loading={checkingUpdates} variant="secondary" />
      </AppCard>
    </AppScreen>
  );
};

const ThemeChoice = ({ label, active, colors, onPress }: { label: string; active: boolean; colors: Theme; onPress: () => void }) => (
  <TouchableOpacity style={[choiceStyles.choice, active && { borderColor: colors.primary }]} onPress={onPress}>
    <View style={[choiceStyles.preview, { backgroundColor: colors.background }]}>
      <View style={[choiceStyles.previewBar, { backgroundColor: colors.cardBackground }]} />
    </View>
    <Text style={[choiceStyles.choiceText, { color: colors.text }]}>{label}</Text>
  </TouchableOpacity>
);

const InfoRow = ({ label, value, theme }: { label: string; value: string; theme: Theme }) => (
  <View style={choiceStyles.infoRow}>
    <Text style={{ color: theme.textSecondary }}>{label}</Text>
    <Text style={{ color: theme.text, fontWeight: '800' }}>{value}</Text>
  </View>
);

const choiceStyles = StyleSheet.create({
  choice: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', padding: 8, alignItems: 'center' },
  preview: { width: '100%', height: 54, borderRadius: 6, padding: 8, justifyContent: 'flex-end' },
  previewBar: { height: 16, borderRadius: 4 },
  choiceText: { marginTop: 6, fontSize: 12, fontWeight: '800' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
});

const createStyles = (theme: Theme) => StyleSheet.create({
  title: { color: theme.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: theme.textSecondary, marginTop: 4, marginBottom: 16 },
  section: { marginBottom: 12, gap: 12 },
  sectionTitle: { color: theme.text, fontSize: 17, fontWeight: '900' },
  description: { color: theme.textSecondary, lineHeight: 20 },
  fieldLabel: { color: theme.text, fontSize: 14, fontWeight: '800' },
  fieldHint: { color: theme.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 10 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.inputBackground,
  },
  currencyChipText: { color: theme.text, fontSize: 13, fontWeight: '700' },
  warningBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.warningSoft,
  },
  warningText: { flex: 1, color: theme.warning, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  settingTextBlock: { flex: 1 },
  themeOptions: { flexDirection: 'row', gap: 12 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  halfButton: { flex: 1 },
});

export default SettingsScreen;
