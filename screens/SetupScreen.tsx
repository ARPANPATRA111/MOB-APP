import React, { useState } from "react";
import { Image, View } from "react-native";
import AppScreen from "../src/components/ui/AppScreen";
import AppButton from "../src/components/ui/AppButton";
import SelectField from "../src/components/ui/SelectField";
import {
  Copy,
  FormRow,
  Group,
  Notice,
  useAction,
} from "../src/components/ui/CommerceUI";
import { AppText } from "../src/contexts/TypographyContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useCurrency } from "../src/contexts/CurrencyContext";
import { CURRENCIES, currencyPickerLabel } from "../src/domain/currency";
import { validateShopSetup } from "../src/domain/onboarding";
import {
  updateBusinessProfile,
  setSetting,
} from "../src/repositories/settingsRepository";
import { inTransaction } from "../src/db/database";

const marks = {
  light: require("../assets/logo-mark-light.png"),
  dark: require("../assets/logo-mark-dark.png"),
};

export default function SetupScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { theme } = useTheme();
  const currency = useCurrency();
  const action = useAction();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const save = () =>
    action.run(async () => {
      const profile = validateShopSetup(name, code);
      await inTransaction(async (db) => {
        await updateBusinessProfile(profile, db);
        await setSetting("setupComplete", true, db);
      });
      await currency.refresh();
      onComplete();
    });
  return (
    <AppScreen
      theme={theme}
      footer={
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <AppButton
            theme={theme}
            label="Open my shop"
            loading={action.busy}
            disabled={!name.trim() || !code}
            onPress={save}
          />
        </View>
      }
    >
      <View style={{ alignItems: "center", paddingTop: 36, paddingBottom: 28, gap: 6 }}>
        <Image
          source={marks[theme.mode]}
          style={{ width: 88, height: 88, marginBottom: 10 }}
          resizeMode="contain"
        />
        <AppText
          style={{ color: theme.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.7 }}
        >
          Welcome to MOPX
        </AppText>
        <Copy muted center>
          Two quick details and you are ready to sell.
        </Copy>
      </View>
      <Notice message={action.error} error />
      <Group
        title="Your shop"
        footer="You can change these later in Settings. Currency is locked after your first sale to keep records accurate."
      >
        <FormRow
          label="Shop name"
          placeholder="Corner Market"
          value={name}
          onChangeText={setName}
          maxLength={100}
          autoCapitalize="words"
          returnKeyType="done"
        />
        <SelectField
          inset
          label="Currency"
          placeholder="Select"
          value={code}
          options={CURRENCIES.map((c) => ({
            value: c.code,
            label: currencyPickerLabel(c),
            detail: c.label,
          }))}
          onChange={setCode}
        />
      </Group>
    </AppScreen>
  );
}
