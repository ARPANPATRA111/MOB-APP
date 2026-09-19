import React from "react";
import Constants from "expo-constants";
import { Alert, Image, Linking, View } from "react-native";
import { useTheme } from "../src/contexts/ThemeContext";
import { AppText } from "../src/contexts/TypographyContext";
import {
  developerInfo,
  isAllowedDeveloperUrl,
} from "../src/domain/developerInfo";
import { APP_MEANING, APP_TAGLINE } from "../src/domain/branding";
import AppScreen from "../src/components/ui/AppScreen";
import { Copy, Group, ListRow, Panel } from "../src/components/ui/CommerceUI";

const marks = {
  light: require("../assets/logo-mark-light.png"),
  dark: require("../assets/logo-mark-dark.png"),
};

const AboutScreen: React.FC = () => {
  const { theme } = useTheme();

  const openUrl = async (url: string) => {
    try {
      if (!isAllowedDeveloperUrl(url)) throw new Error("Unsupported link");
      if (!(await Linking.canOpenURL(url)))
        throw new Error("This device cannot open the link");
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Link unavailable", (error as Error).message);
    }
  };

  return (
    <AppScreen theme={theme}>
      <View style={{ alignItems: "center", paddingVertical: 20, gap: 4 }}>
        <Image
          source={marks[theme.mode]}
          style={{ width: 84, height: 84, marginBottom: 8 }}
          resizeMode="contain"
        />
        <AppText style={{ color: theme.text, fontSize: 22, fontWeight: "700", letterSpacing: 1 }}>
          MOPX
        </AppText>
        <Copy muted>
          {APP_TAGLINE} · v{Constants.expoConfig?.version ?? ""}
        </Copy>
        <Copy muted>{APP_MEANING}</Copy>
      </View>
      <Panel title="About">
        <Copy>
          MOPX is an offline-first retail app for small shops: fast billing,
          stock tracking, receipts and local reports without needing internet.
        </Copy>
      </Panel>
      <Panel
        title="Your records"
        footer="Android automatic backup is disabled. Save a backup outside your phone before uninstalling or changing devices."
      >
        <Copy>
          Records stay in this app on your phone; there is no account or cloud
          sync. Backups are password-encrypted. Receipt PDFs and CSV exports are
          readable by anyone you share them with.
        </Copy>
      </Panel>
      <Group title="Developer" footer={developerInfo.description}>
        <ListRow icon="person" iconColor="#5856d6" title={developerInfo.name} />
        <ListRow
          icon="mail"
          iconColor="#0a7aff"
          title={developerInfo.email}
          onPress={() => openUrl(`mailto:${developerInfo.email}`)}
        />
        <ListRow
          icon="globe"
          iconColor="#34c759"
          title="arpan111.vercel.app"
          onPress={() => openUrl(developerInfo.portfolio)}
        />
      </Group>
    </AppScreen>
  );
};

export default AboutScreen;
