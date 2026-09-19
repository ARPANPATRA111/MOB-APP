import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { AppText } from "../../contexts/TypographyContext";

/**
 * iOS-style navigation bar: tinted back chevron, centred title, optional
 * right item from `options.headerRight`. Explicit safe-area padding keeps the
 * Android edge-to-edge header above the keyboard.
 */
export default function StackHeader({
  back,
  navigation,
  options,
  route,
}: NativeStackHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const right = options.headerRight?.({ canGoBack: !!back, tintColor: theme.primary });
  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: theme.chrome,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.chromeBorder,
      }}
    >
      <View
        style={{
          height: 48,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 6,
        }}
      >
        <View style={{ minWidth: 72, flexDirection: "row", alignItems: "center" }}>
          {back && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={navigation.goBack}
              hitSlop={6}
              style={({ pressed }) => ({
                height: 44,
                paddingHorizontal: 6,
                flexDirection: "row",
                alignItems: "center",
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={26} color={theme.primary} />
            </Pressable>
          )}
        </View>
        <AppText
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 16,
            fontWeight: "600",
            color: theme.text,
          }}
        >
          {options.title ?? route.name}
        </AppText>
        {/* Side slots share a minimum width so a lone title stays centred; two right icons may widen it slightly. */}
        <View style={{ minWidth: 72, alignItems: "flex-end", justifyContent: "center" }}>
          {right}
        </View>
      </View>
    </View>
  );
}
