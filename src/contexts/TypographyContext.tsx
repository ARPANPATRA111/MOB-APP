import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform, Text, type TextProps, type TextStyle, StyleSheet } from "react-native";
import {
  normalizeTextSize,
  textSizeScale,
  type TextSize,
} from "../domain/onboarding";
import { getSetting, setSetting } from "../repositories/settingsRepository";
import { storageService } from "../services/storage";
import { subscribeData } from "../services/dataEvents";

const Context = createContext({
  size: "medium" as TextSize,
  scale: 1,
  setSize: async (_size: TextSize) => {},
});
export function TypographyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [size, update] = useState<TextSize>("medium");
  useEffect(() => {
    let active = true;
    const load = async () => {
      await storageService.ensureDataLayerReady();
      const stored = await getSetting("textSize", "medium");
      if (active) update(normalizeTextSize(stored));
    };
    void load().catch(() => {});
    const unsub = subscribeData(() => void load().catch(() => {}));
    return () => {
      active = false;
      unsub();
    };
  }, []);
  const setSize = useCallback(async (next: TextSize) => {
    await setSetting("textSize", next);
    update(next);
  }, []);
  return (
    <Context.Provider value={{ size, scale: textSizeScale(size), setSize }}>
      {children}
    </Context.Provider>
  );
}
export const useTypography = () => useContext(Context);
/**
 * Two-face type system: Plus Jakarta Sans carries titles, headline numbers and
 * anything heavy at 18pt+, Inter carries everything readable at body sizes.
 */
export const fontFamily = (weight?: TextStyle["fontWeight"], size = 14) => {
  const w = weight === "bold" ? 700 : Number(weight) || 400;
  if (size >= 18 && w >= 600) {
    return w >= 800
      ? "PlusJakartaSans_800ExtraBold"
      : w >= 700
        ? "PlusJakartaSans_700Bold"
        : "PlusJakartaSans_600SemiBold";
  }
  return w >= 700
    ? "Inter_700Bold"
    : w >= 600
      ? "Inter_600SemiBold"
      : w >= 500
        ? "Inter_500Medium"
        : "Inter_400Regular";
};

/** Inter reads best with slightly tighter tracking as it grows. */
const tracking = (size: number) =>
  size >= 24 ? -0.6 : size >= 18 ? -0.35 : size >= 15 ? -0.15 : 0;

/**
 * Android measures text without positive letter spacing and then clips the
 * wider glyph run (visible as a chopped last letter on centred labels, worst
 * on One UI). Negative tracking is safe; positive tracking is dropped there.
 */
const safeTracking = (value: number) => (Platform.OS === "android" && value > 0 ? 0 : value);

/** App text scales independently of system accessibility scaling; icon fonts stay untouched. */
export function AppText({ style, ...props }: TextProps) {
  const { scale } = useTypography();
  const flat = StyleSheet.flatten(style) ?? {};
  const size = (flat.fontSize ?? 14) * scale;
  return (
    <Text
      maxFontSizeMultiplier={1.2}
      {...props}
      style={[
        style,
        {
          fontFamily: fontFamily(flat.fontWeight, flat.fontSize ?? 14),
          fontWeight: "normal",
          fontSize: size,
          letterSpacing: safeTracking(flat.letterSpacing ?? tracking(flat.fontSize ?? 14)),
          ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : {}),
        },
      ]}
    />
  );
}
