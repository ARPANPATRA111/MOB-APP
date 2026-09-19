import React from "react";
import { View } from "react-native";
import type { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { AppText } from "../../contexts/TypographyContext";

/** iOS large-title header for top-level tabs; right item comes from `options.headerRight`. */
export default function TabHeader({ options, route }: BottomTabHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const right = options.headerRight?.({ tintColor: theme.primary, canGoBack: false });
  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 8,
        paddingBottom: 4,
        backgroundColor: theme.background,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        minHeight: insets.top + 50,
      }}
    >
      <AppText
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 28,
          fontWeight: "700",
          color: theme.text,
          letterSpacing: -0.7,
        }}
      >
        {options.title ?? route.name}
      </AppText>
      {right && <View style={{ paddingBottom: 2 }}>{right}</View>}
    </View>
  );
}
