import { AppText as Text } from '../../contexts/TypographyContext';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme, Theme } from '../../contexts/ThemeContext';
import { useReducedMotion } from './Skeleton';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface ToastOptions {
  message: string;
  /** Optional second line. */
  detail?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Defaults to 2400. */
  duration?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions | string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  hideToast: () => {},
});

const iconFor = (theme: Theme, variant: ToastVariant) => {
  switch (variant) {
    case 'success':
      return { name: 'checkmark-circle' as const, color: theme.success };
    case 'warning':
      return { name: 'warning' as const, color: theme.warning };
    case 'error':
      return { name: 'close-circle' as const, color: theme.danger };
    case 'info':
      return { name: 'information-circle' as const, color: theme.primary };
    default:
      return { name: 'ellipse' as const, color: theme.primary };
  }
};

interface ToastState extends Required<Omit<ToastOptions, 'detail'>> {
  key: number;
  detail?: string;
}

const HIDDEN_Y = -120;

/**
 * iOS-style banner: a floating card that springs down from the top, then slides
 * back up when tapped, swiped upward, or after its timeout. One banner at a time;
 * a new message replaces the current one.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const animateOut = useCallback(
    (fast = false) => {
      clearTimer();
      if (reduced) {
        opacity.setValue(0);
        setToast(null);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: fast ? 120 : 200, useNativeDriver: true }),
        Animated.timing(translateY, {
          toValue: HIDDEN_Y,
          duration: fast ? 160 : 240,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setToast(null);
          drag.setValue(0);
        }
      });
    },
    [clearTimer, drag, opacity, reduced, translateY]
  );

  const hideToast = useCallback(() => animateOut(), [animateOut]);

  const showToast = useCallback(
    (options: ToastOptions | string) => {
      const normalized: ToastOptions = typeof options === 'string' ? { message: options } : options;
      keyRef.current += 1;
      const next: ToastState = {
        key: keyRef.current,
        message: normalized.message,
        detail: normalized.detail,
        variant: normalized.variant ?? 'neutral',
        duration: normalized.duration ?? 2400,
      };
      clearTimer();
      setToast(next);
      drag.setValue(0);
      if (reduced) {
        opacity.setValue(1);
        translateY.setValue(0);
      } else {
        translateY.setValue(HIDDEN_Y);
        opacity.setValue(0);
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.spring(translateY, {
            toValue: 0,
            damping: 18,
            stiffness: 220,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]).start();
      }
      timerRef.current = setTimeout(() => animateOut(), next.duration);
    },
    [animateOut, clearTimer, drag, opacity, translateY, reduced]
  );

  // Swipe up (or tap) to dismiss, like an iOS notification banner.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => clearTimer(),
        onPanResponderMove: (_, g) => {
          // Only upward drags move the banner; downward pulls feel rubber-banded.
          drag.setValue(g.dy < 0 ? g.dy : g.dy * 0.15);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -24 || g.vy < -0.5 || (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6)) {
            animateOut(true);
          } else {
            Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
            timerRef.current = setTimeout(() => animateOut(), 1400);
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [animateOut, clearTimer, drag]
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);
  const icon = toast ? iconFor(theme, toast.variant) : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && icon ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            { top: insets.top + 6, opacity, transform: [{ translateY }, { translateY: drag }] },
          ]}
        >
          <Animated.View
            {...responder.panHandlers}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[
              styles.card,
              {
                backgroundColor: theme.mode === 'dark' ? '#2c2c2e' : '#ffffff',
                shadowColor: '#000',
              },
            ]}
          >
            <View style={[styles.iconWell, { backgroundColor: `${icon.color}1f` }]}>
              <Ionicons name={icon.name} size={20} color={icon.color} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                {toast.message}
              </Text>
              {!!toast.detail && (
                <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={2}>
                  {toast.detail}
                </Text>
              )}
            </View>
            <View style={[styles.grabber, { backgroundColor: theme.divider }]} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 1000,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 18,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  detail: { fontSize: 12, lineHeight: 16 },
  grabber: {
    position: 'absolute',
    top: 5,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 4,
    borderRadius: 2,
  },
});

export default ToastProvider;
