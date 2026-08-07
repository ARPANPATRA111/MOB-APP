import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/typography';

/** Route name of the action-only slot. It renders as the raised centre button. */
export const ACTION_TAB_NAME = 'NewBill';

interface TabMeta {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TAB_META: Record<string, TabMeta> = {
  Dashboard: { icon: 'home-outline', activeIcon: 'home', label: 'Home' },
  Inventory: { icon: 'cube-outline', activeIcon: 'cube', label: 'Stock' },
  Reports: { icon: 'stats-chart-outline', activeIcon: 'stats-chart', label: 'Reports' },
  Settings: { icon: 'settings-outline', activeIcon: 'settings', label: 'Settings' },
};

/**
 * Bottom tab bar with a raised primary action in the middle slot.
 *
 * Painted with `theme.chrome` — the same token as the navigation header — so
 * the top and bottom of every screen stay on one surface, and the strip behind
 * the transparent Android navigation bar is themed rather than OS-default.
 *
 * The centre button deliberately stays *within* the bar's bounds rather than
 * floating above it: Android clips children that overflow their parent, so a
 * genuinely raised button would need a transparent spacer and is fragile. Colour
 * and elevation carry the prominence instead.
 */
const AppTabBar: React.FC<BottomTabBarProps & { theme: Theme; onAction: () => void }> = ({
  state,
  navigation,
  theme,
  onAction,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.chrome,
          borderTopColor: theme.chromeBorder,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;

        if (route.name === ACTION_TAB_NAME) {
          return (
            <View key={route.key} style={styles.actionSlot}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                activeOpacity={0.85}
                onPress={onAction}
                accessibilityRole="button"
                accessibilityLabel="Start a new bill"
              >
                <Ionicons name="add" size={26} color={theme.onPrimary} />
              </TouchableOpacity>
              <Text style={[styles.actionLabel, { color: theme.primary }]} numberOfLines={1}>
                New Bill
              </Text>
            </View>
          );
        }

        const meta = TAB_META[route.name];
        if (!meta) {
          return null;
        }

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            activeOpacity={0.7}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
          >
            <Ionicons
              name={focused ? meta.activeIcon : meta.icon}
              size={22}
              color={focused ? theme.primary : theme.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: focused ? theme.primary : theme.textSecondary },
                focused && styles.labelActive,
              ]}
            >
              {meta.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    minHeight: 52,
    paddingTop: 4,
  },
  label: { ...typography.caption, fontSize: 11, fontWeight: '600' },
  labelActive: { fontWeight: '800' },
  actionSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    minHeight: 52,
  },
  actionButton: {
    width: 46,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionLabel: { ...typography.caption, fontSize: 11, fontWeight: '800' },
});

export default AppTabBar;
