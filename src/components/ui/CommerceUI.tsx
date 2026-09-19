import { AppText as Text, useTypography } from '../../contexts/TypographyContext';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../contexts/ThemeContext';

import { useLiveData } from '../../services/dataEvents';

/**
 * iOS-style primitives shared by every screen. The vocabulary is Apple's:
 * grouped inset cards (`Panel`/`Group`), table rows with inset hairlines
 * (`ListRow`), a segmented control (`Choices`), a pill search field and
 * footnote-style hints. Everything is compact so retail lists fit a phone.
 */
export const ui = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.6 },
  heading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stack: { gap: 10 },
  grow: { flex: 1 },
  muted: { fontSize: 13, lineHeight: 18 },
  footnote: { fontSize: 12, lineHeight: 16 },
});

export const RADIUS = 14;
const HAIRLINE = StyleSheet.hairlineWidth;

/**
 * True inside a `Group` (unpadded table). Rows use it to decide whether they
 * supply their own 14pt inset and inset separators, or sit flush inside a
 * padded `Panel` with a plain bottom hairline like a classic list.
 */
export const TableContext = createContext(false);
export const useInTable = () => useContext(TableContext);

export function Copy({
  children,
  muted = false,
  large = false,
  center = false,
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  large?: boolean;
  center?: boolean;
  numberOfLines?: number;
}) {
  const { theme } = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        large ? ui.title : muted ? ui.muted : ui.body,
        { color: muted ? theme.textSecondary : theme.text },
        center && { textAlign: 'center' },
      ]}
    >
      {children}
    </Text>
  );
}

/** Uppercase footnote used above grouped sections, as in iOS Settings. */
export function GroupTitle({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        color: theme.textSecondary,
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginLeft: 14,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

/** Rounded inset card. `title` renders as an iOS group header above the card. */
export function Panel({
  children,
  title,
  footer,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  title?: string;
  footer?: string;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      {title && <GroupTitle>{title}</GroupTitle>}
      <TableContext.Provider value={!padded}>
        <View
          style={[
            {
              backgroundColor: theme.cardBackground,
              borderRadius: RADIUS,
              paddingHorizontal: padded ? 14 : 0,
              paddingVertical: padded ? 12 : 0,
              gap: padded ? 10 : 0,
              overflow: 'hidden',
            },
            style,
          ]}
        >
          {children}
        </View>
      </TableContext.Provider>
      {footer && (
        <Text
          style={[ui.footnote, { color: theme.textSecondary, marginTop: 6, marginHorizontal: 14 }]}
        >
          {footer}
        </Text>
      )}
    </View>
  );
}

/** Grouped table: rows separated by inset hairlines, no card padding. */
export function Group({
  children,
  title,
  footer,
}: {
  children: React.ReactNode;
  title?: string;
  footer?: string;
}) {
  return (
    <Panel title={title} footer={footer} padded={false}>
      <Separated>{children}</Separated>
    </Panel>
  );
}

/** Inserts inset hairlines between visible children. */
export function Separated({ children, inset = 14 }: { children: React.ReactNode; inset?: number }) {
  const { theme } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <View
              style={{ height: HAIRLINE, backgroundColor: theme.divider, marginLeft: inset }}
            />
          )}
          {child}
        </React.Fragment>
      ))}
    </>
  );
}

const inputStyle = (theme: ReturnType<typeof useTheme>['theme'], scale: number, multiline?: boolean) => ({
  minHeight: 44,
  borderRadius: 11,
  paddingHorizontal: 12,
  paddingVertical: 9,
  fontSize: 15 * scale,
  fontFamily: 'Inter_400Regular',
  color: theme.text,
  backgroundColor: theme.inputBackground,
  textAlignVertical: (multiline ? 'top' : 'center') as 'top' | 'center',
});

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  const { theme } = useTheme();
  const { scale } = useTypography();
  return (
    <View style={{ gap: 5, flexShrink: 1 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.placeholder}
        maxLength={200}
        maxFontSizeMultiplier={1.2}
        cursorColor={theme.primary}
        selectionColor={theme.primarySoft}
        {...props}
        style={[inputStyle(theme, scale, props.multiline), props.style]}
      />
      {hint && <Text style={[ui.footnote, { color: theme.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

/**
 * iOS form row: label on the left, input on the right, meant to live inside a
 * `Group`. Keeps forms short because each field is a single 46pt line.
 */
export function FormRow({
  label,
  hint,
  trailing,
  invalid = false,
  required = false,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
  /** Highlights the row in red (label, background) until the value is corrected. */
  invalid?: boolean;
  /** Marks the label with a red asterisk. */
  required?: boolean;
}) {
  const { theme } = useTheme();
  const { scale } = useTypography();
  return (
    <View
      accessibilityState={{ ...(invalid ? { disabled: false } : {}) }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: props.multiline ? 10 : 4,
        gap: 4,
        backgroundColor: invalid ? theme.dangerSoft : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 38 }}>
        <Text
          style={{ color: invalid ? theme.danger : theme.text, fontSize: 14, minWidth: 96, maxWidth: '40%' }}
          numberOfLines={2}
        >
          {label}
          {required && <Text style={{ color: theme.danger }}> *</Text>}
        </Text>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.placeholder}
          maxLength={200}
          maxFontSizeMultiplier={1.2}
        cursorColor={theme.primary}
        selectionColor={theme.primarySoft}
          {...props}
          style={[
            {
              flex: 1,
              fontSize: 15 * scale,
              fontFamily: 'Inter_400Regular',
              color: theme.text,
              textAlign: 'right',
              paddingVertical: props.multiline ? 4 : 8,
              minHeight: props.multiline ? 72 : 38,
              textAlignVertical: props.multiline ? 'top' : 'center',
            },
            props.style,
          ]}
        />
        {trailing}
      </View>
      {hint && <Text style={[ui.footnote, { color: theme.textSecondary, paddingBottom: 6 }]}>{hint}</Text>}
    </View>
  );
}

/** Pill search field with a magnifier and clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { theme } = useTheme();
  const { scale } = useTypography();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        borderRadius: 12,
        paddingHorizontal: 10,
        backgroundColor: theme.inputBackground,
      }}
    >
      <Ionicons name="search" size={17} color={theme.textSecondary} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={theme.placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="never"
        maxLength={100}
        maxFontSizeMultiplier={1.2}
        cursorColor={theme.primary}
        selectionColor={theme.primarySoft}
        style={{
          flex: 1,
          fontSize: 15 * scale,
          fontFamily: 'Inter_400Regular',
          color: theme.text,
          paddingVertical: 8,
        }}
      />
      {!!value && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={theme.placeholder} />
        </Pressable>
      )}
    </View>
  );
}

/** iOS segmented control. */
export function Choices<T extends string>({
  value,
  options,
  onChange,
  compact = false,
}: {
  value: T;
  options: { value: NoInfer<T>; label: string }[];
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.inputBackground,
        borderRadius: 9,
        padding: 2,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: compact ? 30 : 34,
              borderRadius: 7,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
              backgroundColor: selected ? theme.cardBackground : 'transparent',
              shadowColor: '#000',
              shadowOpacity: selected ? 0.12 : 0,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: selected ? 1 : 0,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: theme.text,
                fontSize: compact ? 12 : 13,
                fontWeight: selected ? '600' : '400',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Notice({
  message,
  error = false,
  onRetry,
}: {
  message?: string | null;
  error?: boolean;
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  if (!message) return null;
  return (
    <View
      accessibilityRole={error ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: error ? theme.dangerSoft : theme.primarySoft,
        marginBottom: 12,
      }}
    >
      <Ionicons
        name={error ? 'alert-circle' : 'information-circle'}
        size={18}
        color={error ? theme.danger : theme.primary}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[ui.muted, { color: error ? theme.danger : theme.text }]}>{message}</Text>
        {onRetry && (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={{ minHeight: 32, justifyContent: 'center' }}
          >
            <Text style={{ fontWeight: '600', fontSize: 13, color: theme.primary }}>Try again</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Table row. Inside `Group` it gets inset hairlines automatically. */
export function ListRow({
  title,
  subtitle,
  trailing,
  onPress,
  icon,
  iconColor,
  right,
  destructive = false,
  chevron,
}: {
  title: string;
  subtitle?: string;
  trailing?: string;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  /** Custom trailing element (switch, badge…). */
  right?: React.ReactNode;
  destructive?: boolean;
  chevron?: boolean;
}) {
  const { theme } = useTheme();
  const inTable = useInTable();
  const showChevron = chevron ?? (!!onPress && !right);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: subtitle ? 9 : 11,
        paddingHorizontal: 14,
        // Inside a padded Panel, bleed to the card edge so the press highlight
        // and hairline run full width like a table row would.
        marginHorizontal: inTable ? 0 : -14,
        minHeight: 46,
        backgroundColor: pressed ? theme.inputBackground : 'transparent',
        borderBottomWidth: inTable ? 0 : HAIRLINE,
        borderBottomColor: theme.divider,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      })}
    >
      {icon && (
        <View
          style={{
            width: 29,
            height: 29,
            borderRadius: 7,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: iconColor ?? theme.primary,
          }}
        >
          <Ionicons name={icon} size={17} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={2}
          style={{
            color: destructive ? theme.danger : theme.text,
            fontSize: 14,
            fontWeight: '500',
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text numberOfLines={2} style={[ui.footnote, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing && (
        <Text
          numberOfLines={1}
          style={{
            color: theme.textSecondary,
            fontSize: 14,
            flexShrink: 1,
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
          }}
        >
          {trailing}
        </Text>
      )}
      {right}
      {showChevron && <Ionicons name="chevron-forward" size={16} color={theme.placeholder} />}
    </Pressable>
  );
}

/** Large number with a caption, for summary tiles. */
export function Stat({
  label,
  value,
  caption,
  color,
}: {
  label: string;
  value: string;
  caption?: string;
  color?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={[ui.footnote, { color: theme.textSecondary, fontWeight: '500' }]}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: color ?? theme.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      {caption && <Text style={[ui.footnote, { color: theme.textSecondary }]}>{caption}</Text>}
    </View>
  );
}

/** Round icon well used by empty states and onboarding. */
export function IconWell({
  name,
  size = 30,
  tint,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  tint?: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        width: size * 2.2,
        height: size * 2.2,
        borderRadius: size * 1.1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.primarySoft,
      }}
    >
      <Ionicons name={name} size={size} color={tint ?? theme.primary} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8, paddingHorizontal: 24 }}>
      <IconWell name={icon} />
      <Text style={[ui.heading, { color: theme.text, marginTop: 6, textAlign: 'center' }]}>{title}</Text>
      {message && (
        <Text style={[ui.muted, { color: theme.textSecondary, textAlign: 'center' }]}>{message}</Text>
      )}
      {children}
    </View>
  );
}

export function Busy() {
  const { theme } = useTheme();
  return (
    <ActivityIndicator accessibilityLabel="Loading" style={{ padding: 24 }} color={theme.primary} />
  );
}

/** Guards responses from older searches. Loaders should be memoized with useCallback. */

export function useQuery<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);

  useEffect(
    () => () => {
      sequence.current++;
    },
    []
  );

  const reload = useCallback(() => {
    const id = ++sequence.current;
    setLoading(true);
    setError(null);
    loader()
      .then((value) => {
        if (id === sequence.current) setData(value);
      })
      .catch((e) => {
        if (id === sequence.current) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Could not load data');
        }
      })
      .finally(() => {
        if (id === sequence.current) setLoading(false);
      });
  }, [loader]);

  useLiveData(reload);
  return { data, error, loading, reload, setData };
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = async (action: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete this action');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return { busy, error, run, setError };
}
