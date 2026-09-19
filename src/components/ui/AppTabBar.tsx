import { AppText as Text } from '../../contexts/TypographyContext';
import React from "react";
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme } from "../../contexts/ThemeContext";
import { useKeyboardOpen } from "../../hooks/useKeyboardOpen";
import { CONTENT_MAX_WIDTH } from "./AppScreen";

/** Route name of the action-only slot. It renders as the raised centre button. */
export const ACTION_TAB_NAME = "NewBill";

interface TabMeta {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TAB_META: Record<string, TabMeta> = {
  Dashboard: { icon: "home-outline", activeIcon: "home", label: "Home" },
  Inventory: { icon: "cube-outline", activeIcon: "cube", label: "Stock" },
  Reports: { icon: "stats-chart-outline", activeIcon: "stats-chart", label: "Reports" },
  Settings: { icon: "settings-outline", activeIcon: "settings", label: "Settings" },
};

/**
 * iOS tab bar with a raised primary action in the centre slot. Painted with
 * `theme.chrome` (same as the navigation header) so top and bottom of every
 * screen read as one surface. Hidden while the keyboard is up.
 */
const AppTabBar: React.FC<BottomTabBarProps & { theme: Theme; onAction: () => void }> = ({
  state,
  navigation,
  theme,
  onAction,
}) => {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardOpen();
  if (keyboardVisible) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.chrome,
          borderTopColor: theme.chromeBorder,
          paddingBottom: Math.max(insets.bottom, 6),
          // Landscape cutouts sit beside the bar, not above it.
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      <View style={styles.row}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        if (route.name === ACTION_TAB_NAME) {
          return (
            <View key={route.key} style={styles.actionSlot}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={onAction}
                accessibilityRole="button"
                accessibilityLabel="Start a new bill"
              >
                <Ionicons name="add" size={28} color={theme.onPrimary} />
              </Pressable>
              <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
                New bill
              </Text>
            </View>
          );
        }
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        const color = focused ? theme.primary : theme.textSecondary;
        return (
          <Pressable
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
          >
            <Ionicons name={focused ? meta.activeIcon : meta.icon} size={23} color={color} />
            <Text numberOfLines={1} style={[styles.label, { color }]}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  // The bar surface spans the window; the tabs themselves stay in the same
  // centred column the screens use, so a tablet does not fling them to the edges.
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 4,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 48, paddingTop: 3 },
  label: { fontSize: 10, fontWeight: "500" },
  actionSlot: { flex: 1, alignItems: "center", gap: 2, minHeight: 48, marginTop: -4 },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0a7aff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});

export default AppTabBar;
