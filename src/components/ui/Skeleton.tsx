import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  DimensionValue,
  Easing,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Theme } from '../../contexts/ThemeContext';

/** Tracks the OS "reduce motion" accessibility setting. */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) {
          setReduced(value);
        }
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
};

/**
 * Delays turning a loading flag "true" so quick loads never flash a skeleton.
 * Returns true only if `active` stays true past `delayMs`.
 */
export const useDelayedFlag = (active: boolean, delayMs = 180): boolean => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);
  return show;
};

interface SkeletonProps {
  theme: Theme;
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

const skeletonColor = (theme: Theme) => (theme.mode === 'dark' ? '#2a2a2a' : '#e4e9f0');

/** A single shimmering placeholder block. Uses the native driver (opacity only). */
export const Skeleton: React.FC<SkeletonProps> = ({
  theme,
  width = '100%',
  height = 16,
  radius = 8,
  style,
}) => {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: skeletonColor(theme), opacity },
        style,
      ]}
    />
  );
};

/** A stack of line placeholders (last line shortened). */
export const SkeletonLines: React.FC<{ theme: Theme; lines?: number; style?: ViewStyle }> = ({
  theme,
  lines = 3,
  style,
}) => (
  <View style={style}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        theme={theme}
        height={12}
        width={index === lines - 1 ? '60%' : '100%'}
        style={{ marginBottom: index === lines - 1 ? 0 : 10 }}
      />
    ))}
  </View>
);

/** A card-shaped placeholder used for stat tiles / list rows. */
export const SkeletonCard: React.FC<{ theme: Theme; height?: number; style?: ViewStyle }> = ({
  theme,
  height = 96,
  style,
}) => (
  <View style={[styles.card, { backgroundColor: theme.cardBackground }, style]}>
    <Skeleton theme={theme} width="40%" height={12} />
    <Skeleton theme={theme} width="70%" height={20} style={{ marginTop: 12 }} />
    <View style={{ flex: 1 }} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    minHeight: 96,
  },
});

export default Skeleton;
