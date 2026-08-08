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
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Theme } from '../../contexts/ThemeContext';
import { useReducedMotion } from './Skeleton';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Defaults to 2200. */
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

const variantStyle = (theme: Theme, variant: ToastVariant) => {
  const dark = theme.mode === 'dark';
  switch (variant) {
    case 'success':
      return { bg: dark ? '#14532d' : '#dcfce7', fg: dark ? '#dcfce7' : '#166534', icon: 'checkmark-circle' as const };
    case 'warning':
      return { bg: dark ? '#78350f' : '#fef3c7', fg: dark ? '#fef3c7' : '#92400e', icon: 'warning' as const };
    case 'error':
      return { bg: dark ? '#7f1d1d' : '#fee2e2', fg: dark ? '#fee2e2' : '#991b1b', icon: 'alert-circle' as const };
    case 'info':
      return { bg: dark ? '#1e3a5f' : '#dbeafe', fg: dark ? '#dbeafe' : '#1e40af', icon: 'information-circle' as const };
    default:
      return { bg: dark ? '#1f2937' : '#111827', fg: '#ffffff', icon: 'ellipse' as const };
  }
};

interface ToastState extends Required<ToastOptions> {
  key: number;
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const animateOut = useCallback(() => {
    if (reduced) {
      opacity.setValue(0);
      setToast(null);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 80, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setToast(null);
      }
    });
  }, [opacity, translateY, reduced]);

  const hideToast = useCallback(() => {
    clearTimer();
    animateOut();
  }, [clearTimer, animateOut]);

  const showToast = useCallback(
    (options: ToastOptions | string) => {
      const normalized: ToastOptions = typeof options === 'string' ? { message: options } : options;
      keyRef.current += 1;
      const next: ToastState = {
        key: keyRef.current,
        message: normalized.message,
        variant: normalized.variant ?? 'neutral',
        duration: normalized.duration ?? 2200,
      };
      clearTimer();
      setToast(next);
      if (reduced) {
        opacity.setValue(1);
        translateY.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      }
      timerRef.current = setTimeout(() => animateOut(), next.duration);
    },
    [animateOut, clearTimer, opacity, translateY, reduced]
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);
  const palette = toast ? variantStyle(theme, toast.variant) : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && palette ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { bottom: Math.max(insets.bottom, 12) + 12, opacity, transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.toast, { backgroundColor: palette.bg }]}>
            <Ionicons name={palette.icon} size={18} color={palette.fg} style={styles.icon} />
            <Text style={[styles.text, { color: palette.fg }]} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 520,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ToastProvider;
