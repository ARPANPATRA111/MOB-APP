import React, { useCallback, useLayoutEffect } from "react";
import { Linking, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AppScreen from "../src/components/ui/AppScreen";
import {
  Choices,
  Copy,
  Group,
  ListRow,
  Notice,
  useAction,
  useQuery,
} from "../src/components/ui/CommerceUI";
import { AppText, useTypography } from "../src/contexts/TypographyContext";
import { useTheme, type ThemeMode } from "../src/contexts/ThemeContext";
import { useToast } from "../src/components/ui/ToastProvider";
import { type TextSize } from "../src/domain/onboarding";
import { storageService } from "../src/services/storage";
import { applyOtaUpdate, checkForUpdates, checkOtaUpdate, getPendingUpdate } from "../src/services/updateCheck";

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        minHeight: 46,
      }}
    >
      <AppText style={{ color: theme.text, fontSize: 14, minWidth: 72 }}>{label}</AppText>
      <View style={{ flex: 1, maxWidth: 240 }}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const typography = useTypography();
  const navigation = useNavigation<any>();
  const action = useAction();
  const profile = useQuery(
    useCallback(() => storageService.getBusinessProfile(), []),
  );
  const update = useQuery(useCallback(() => getPendingUpdate(), []));
  const { showToast } = useToast();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("About")}
          accessibilityRole="button"
          accessibilityLabel="About MOPX"
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <Ionicons name="information-circle-outline" size={25} color={theme.primary} />
        </Pressable>
      ),
    });
  }, [navigation, theme.primary]);
  return (
    <AppScreen theme={theme}>
      <Notice message={action.error || profile.error} error />
      {update.data && (
        <Group title="Update available">
          <ListRow
            icon="arrow-up-circle"
            iconColor={update.data.important ? "#ff3b30" : "#34c759"}
            title={update.data.title}
            subtitle={update.data.message}
            onPress={() => update.data?.url && Linking.openURL(update.data.url).catch(() => {})}
            chevron={!!update.data.url}
          />
        </Group>
      )}
      <Group title="Your business">
        <ListRow
          icon="storefront"
          iconColor="#5856d6"
          title={profile.data?.businessName || "Shop details"}
          subtitle={`${profile.data?.currencyCode || "INR"} · Name, currency, receipt details`}
          onPress={() => navigation.navigate("BusinessDetails")}
        />
        <ListRow
          icon="print"
          iconColor="#ff9500"
          title="Receipt printer"
          onPress={() => navigation.navigate("Printer")}
        />
      </Group>
      <Group title="Appearance">
        <SettingRow label="Theme">
          <Choices
            compact
            value={themeMode}
            options={[
              { value: "system", label: "Auto" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={(v) => setThemeMode(v as ThemeMode)}
          />
        </SettingRow>
        <SettingRow label="Text size">
          <Choices
            compact
            value={typography.size}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
            onChange={(v) => action.run(() => typography.setSize(v as TextSize))}
          />
        </SettingRow>
      </Group>
      <Group title="Shop tools">
        <ListRow
          icon="grid"
          iconColor="#34c759"
          title="Management"
          subtitle="Parked bills, purchases, suppliers, credit"
          onPress={() => navigation.navigate("Management")}
        />
        <ListRow
          icon="download"
          iconColor="#0a7aff"
          title="Import products"
          subtitle="From a CSV file"
          onPress={() => navigation.navigate("Import")}
        />
        <ListRow
          icon="share-outline"
          iconColor="#5ac8fa"
          title="Export products CSV"
          onPress={() =>
            action.run(async () => {
              const csv = await storageService.exportProductsCsv();
              const uri = FileSystem.cacheDirectory + "MOPX-products.csv";
              await FileSystem.writeAsStringAsync(uri, csv);
              await Sharing.shareAsync(uri, { mimeType: "text/csv" });
            })
          }
        />
      </Group>
      <Group
        title="Data"
        footer="Backups are encrypted with your password and stay on this phone until you share them."
      >
        <ListRow
          icon="shield-checkmark"
          iconColor="#8e8e93"
          title="Backup & restore"
          onPress={() => navigation.navigate("Backup")}
        />
        <ListRow
          icon="refresh"
          iconColor="#0a7aff"
          title="Check for updates"
          trailing={`v${Constants.expoConfig?.version ?? ""}`}
          chevron={false}
          onPress={() =>
            action.run(async () => {
              // 1. Over-the-air JS update (EAS Update). 2. New store/APK release announcement.
              const ota = await checkOtaUpdate();
              if (ota === "installed") {
                showToast({ message: "Update downloaded", detail: "Restarting MOPX to apply it…", variant: "success" });
                setTimeout(() => void applyOtaUpdate().catch(() => {}), 1200);
                return;
              }
              const pending = await checkForUpdates(true);
              showToast(
                pending
                  ? { message: pending.title, detail: "See the row at the top of Settings.", variant: "info" }
                  : { message: "You have the latest version", variant: "success" },
              );
            })
          }
        />
      </Group>
      <Copy muted center>
        MOPX {Constants.expoConfig?.version ?? ""}
      </Copy>
    </AppScreen>
  );
}
