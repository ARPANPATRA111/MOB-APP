import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Theme } from '../../contexts/ThemeContext';

/**
 * Sticky bottom action bar.
 *
 * Owns the bottom safe-area padding on its own — `AppScreen` deliberately does
 * not add any, otherwise the inset is applied twice and the buttons float far
 * above the gesture bar. Painted with `theme.chrome` (the same token the
 * navigation header and tab bar use) so the top and bottom of the screen match,
 * and so the strip behind the transparent Android navigation bar is themed
 * rather than defaulting to the OS colour.
 */
const BottomActionBar: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ theme, children, style }) => {
  const insets = useSafeAreaInsets();
  // Inside the tabs, the tab bar below already clears the gesture area — adding
  // the inset here again would leave a visible dead strip between the two bars.
  const insideTabs = (React.useContext(BottomTabBarHeightContext) ?? 0) > 0;
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.chrome,
          borderTopColor: theme.chromeBorder,
          // Gesture-nav devices report ~16-24px here; button-nav reports ~48px.
          // The small floor keeps the bar off the edge on devices reporting 0.
          paddingBottom: insideTabs ? 10 : Math.max(insets.bottom, 10),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
  },
});

export default BottomActionBar;
