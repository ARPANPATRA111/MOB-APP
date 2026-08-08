import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../contexts/ThemeContext';
import { APP_NAME, APP_TAGLINE } from '../../domain/branding';
import { useReducedMotion } from './Skeleton';

// New MOPX logo (added at repo root alongside the launcher assets).
const logo = require('../../../App_logo.png');

/**
 * In-app themed splash overlay. Rendered on top of the navigator so the handoff
 * from the native (static) splash to the themed app is flash-free, even in dark
 * mode. Fades out once the app reports ready; respects reduce-motion.
 */
const AppSplash: React.FC<{ theme: Theme; visible: boolean }> = ({ theme, visible }) => {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      setMounted(true);
      return;
    }
    if (reduced) {
      setMounted(false);
      return;
    }
    const anim = Animated.timing(opacity, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
    return () => anim.stop();
  }, [visible, reduced, opacity]);

  if (!mounted) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.background, opacity }]}
    >
      <View style={styles.center}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.name, { color: theme.text }]}>{APP_NAME}</Text>
        <Text style={[styles.tagline, { color: theme.textSecondary }]}>{APP_TAGLINE}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 18,
  },
  name: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AppSplash;
