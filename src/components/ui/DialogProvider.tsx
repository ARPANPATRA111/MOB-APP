import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { semanticColors } from '../../theme/colors';

export interface ConfirmConfig {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Styles the confirm button as destructive (red). */
  destructive?: boolean;
}

export interface AlertConfig {
  title?: string;
  message?: string;
  confirmText?: string;
}

interface DialogContextValue {
  /** Themed replacement for Alert.alert with two buttons. Resolves to the choice. */
  confirm: (config: ConfirmConfig) => Promise<boolean>;
  /** Themed single-button acknowledgement. Resolves when dismissed. */
  alert: (config: AlertConfig) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue>({
  confirm: async () => false,
  alert: async () => {},
});

interface InternalDialog {
  mode: 'confirm' | 'alert';
  title?: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
}

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<InternalDialog | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback((config: ConfirmConfig) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        mode: 'confirm',
        title: config.title,
        message: config.message,
        confirmText: config.confirmText ?? 'Confirm',
        cancelText: config.cancelText ?? 'Cancel',
        destructive: config.destructive ?? false,
      });
    });
  }, []);

  const alert = useCallback((config: AlertConfig) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setDialog({
        mode: 'alert',
        title: config.title,
        message: config.message,
        confirmText: config.confirmText ?? 'OK',
        cancelText: '',
        destructive: false,
      });
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);
  const confirmColor = dialog?.destructive ? semanticColors.danger : theme.primary;

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => settle(false)}
      >
        <Pressable
          style={[styles.backdrop, { paddingBottom: insets.bottom, paddingTop: insets.top }]}
          onPress={() => settle(false)}
        >
          {/* Stop propagation so taps inside the card don't dismiss. */}
          <Pressable style={[styles.card, { backgroundColor: theme.cardBackground }]} onPress={() => {}}>
            {dialog?.title ? (
              <Text style={[styles.title, { color: theme.text }]}>{dialog.title}</Text>
            ) : null}
            {dialog?.message ? (
              <Text style={[styles.message, { color: theme.textSecondary }]}>{dialog.message}</Text>
            ) : null}
            <View style={styles.actions}>
              {dialog?.mode === 'confirm' ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  style={[styles.button, styles.cancelButton, { borderColor: theme.divider }]}
                  onPress={() => settle(false)}
                >
                  <Text style={[styles.buttonText, { color: theme.text }]}>{dialog.cancelText}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.button, { backgroundColor: confirmColor }]}
                onPress={() => settle(true)}
              >
                <Text style={[styles.buttonText, styles.confirmText]}>{dialog?.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
};

export const useDialog = () => useContext(DialogContext);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmText: {
    color: '#ffffff',
  },
});

export default DialogProvider;
