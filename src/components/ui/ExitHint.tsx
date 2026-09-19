import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { useTheme } from "../../contexts/ThemeContext";
import { AppText } from "../../contexts/TypographyContext";
import { useReducedMotion } from "./Skeleton";

/** A second back press within this window closes the app. */
const EXIT_WINDOW_MS = 2000;
/** How long the pill stays up. Slightly shorter than the window so it never lies. */
const SHOW_MS = 1800;
/** Clears the tab bar (56 pt plus the home indicator) with a little air. */
const ABOVE_TAB_BAR = 74;

/**
 * Android only. On the home tab, where the navigator has nowhere to go back
 * to, the first hardware back press shows a small pill instead of closing the
 * app; pressing again within two seconds exits. Rendered inside the
 * NavigationContainer so the navigator's own back handling always wins when
 * there is a screen to pop.
 *
 * The pill is inverted against the theme, like an iOS system HUD: dark on the
 * light theme, light on the dark theme.
 */
export default function ExitHint({
  navigationRef,
}: {
  navigationRef: NavigationContainerRefWithCurrent<Record<string, object | undefined>>;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const lastPress = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    if (reduced) {
      setVisible(false);
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && setVisible(false));
  }, [progress, reduced]);

  const show = useCallback(() => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, SHOW_MS);
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, damping: 16, stiffness: 220, mass: 0.7, useNativeDriver: true }).start();
  }, [hide, progress, reduced]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!navigationRef.isReady() || navigationRef.canGoBack()) return false;
      const now = Date.now();
      // Second press inside the window: let Android close the app.
      if (now - lastPress.current < EXIT_WINDOW_MS) return false;
      lastPress.current = now;
      show();
      return true;
    });
    return () => {
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [navigationRef, show]);

  if (!visible) return null;
  const dark = theme.mode === "dark";
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          bottom: insets.bottom + ABOVE_TAB_BAR,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      <Animated.View style={[styles.pill, { backgroundColor: dark ? "#f2f2f7" : "#1c1c1e" }]}>
        <AppText style={[styles.label, { color: dark ? "#0b0b0f" : "#ffffff" }]}>Press back again to exit</AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 900,
  },
  pill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  label: { fontSize: 13, fontWeight: "600" },
});
