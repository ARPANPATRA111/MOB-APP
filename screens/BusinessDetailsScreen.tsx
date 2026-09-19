import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AppScreen from "../src/components/ui/AppScreen";
import AppButton from "../src/components/ui/AppButton";
import SelectField from "../src/components/ui/SelectField";
import {
  Busy,
  FormRow,
  Group,
  Notice,
  useAction,
} from "../src/components/ui/CommerceUI";
import { useTheme } from "../src/contexts/ThemeContext";
import { useCurrency } from "../src/contexts/CurrencyContext";
import { storageService } from "../src/services/storage";
import { CURRENCIES, currencyPickerLabel } from "../src/domain/currency";
import { notifyDataChanged } from "../src/services/dataEvents";
import { useToast } from "../src/components/ui/ToastProvider";
import type { BusinessProfile } from "../src/repositories/settingsRepository";
export default function BusinessDetailsScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const action = useAction();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Partial<BusinessProfile>>({
    businessName: "",
    currencyCode: "INR",
  });
  const setError = action.setError;
  useEffect(() => {
    storageService
      .getBusinessProfile()
      .then((p) => {
        if (p) setProfile(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [setError]);
  const field = (key: keyof BusinessProfile, value: string) =>
    setProfile((p) => ({ ...p, [key]: value }));
  return (
    <AppScreen
      theme={theme}
      footer={
        !loading && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <AppButton
              theme={theme}
              label="Save details"
              loading={action.busy}
              onPress={() =>
                action.run(async () => {
                  if (!profile.businessName?.trim())
                    throw new Error("Enter your shop name.");
                  await storageService.saveBusinessProfile({
                    ...profile,
                    businessName: profile.businessName.trim(),
                  });
                  await currency.refresh();
                  notifyDataChanged();
                  showToast("Shop details saved");
                  navigation.goBack();
                })
              }
            />
          </View>
        )
      }
    >
      <Notice message={action.error} error />
      {loading ? (
        <Busy />
      ) : (
        <>
          <Group
            title="Shop"
            footer="Currency can change until your first sale or purchase. Existing receipts keep their original details."
          >
            <FormRow
              label="Shop name"
              placeholder="Required"
              value={profile.businessName ?? ""}
              onChangeText={(v) => field("businessName", v)}
              maxLength={100}
            />
            <SelectField
              inset
              label="Currency"
              value={profile.currencyCode ?? "INR"}
              options={CURRENCIES.map((c) => ({
                value: c.code,
                label: currencyPickerLabel(c),
                detail: c.label,
              }))}
              onChange={(v) => field("currencyCode", v)}
            />
            <FormRow
              label="Owner"
              placeholder="Optional"
              value={profile.ownerName ?? ""}
              onChangeText={(v) => field("ownerName", v)}
            />
            <FormRow
              label="Phone"
              placeholder="Optional"
              value={profile.phone ?? ""}
              onChangeText={(v) => field("phone", v)}
              keyboardType="phone-pad"
              maxLength={30}
            />
          </Group>
          <Group title="Printed on receipts">
            <FormRow
              label="Address"
              placeholder="Optional"
              value={profile.address ?? ""}
              onChangeText={(v) => field("address", v)}
              multiline
            />
            <FormRow
              label="Tax ID"
              placeholder="GSTIN, VAT… optional"
              value={profile.gstin ?? ""}
              onChangeText={(v) => field("gstin", v)}
              autoCapitalize="characters"
            />
            <FormRow
              label="Footer note"
              placeholder="Thank you for shopping with us."
              value={profile.receiptFooter ?? ""}
              onChangeText={(v) => field("receiptFooter", v)}
              multiline
            />
          </Group>
        </>
      )}
    </AppScreen>
  );
}
