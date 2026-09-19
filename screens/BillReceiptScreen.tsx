import React, { useCallback, useLayoutEffect } from 'react';
import { Pressable, View, type TextStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AppScreen from '../src/components/ui/AppScreen';
import { Busy, Copy, Notice, useAction, useQuery } from '../src/components/ui/CommerceUI';
import { AppText } from '../src/contexts/TypographyContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { storageService } from '../src/services/storage';
import { createReceiptHtml } from '../src/domain/receipt';
import { formatCurrency } from '../src/domain/currency';
import { printReceipt } from '../src/services/receiptPrinting';

const MONO: { fontVariant: TextStyle['fontVariant'] } = { fontVariant: ['tabular-nums'] };

/** Dashed rule like a thermal printer tear line. */
function Rule() {
  const { theme } = useTheme();
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.divider,
        marginVertical: 8,
      }}
    />
  );
}

/** Centred detail line with a small leading icon, e.g. the shop address or phone. */
function Detail({
  icon,
  text,
  lines = 1,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  lines?: number;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, maxWidth: '100%' }}>
      <Ionicons name={icon} size={11} color={theme.textSecondary} />
      <AppText style={{ color: theme.textSecondary, fontSize: 11, flexShrink: 1, textAlign: 'center' }} numberOfLines={lines}>
        {text}
      </AppText>
    </View>
  );
}

function Line({
  label,
  value,
  strong = false,
  muted = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 20, alignItems: 'center' }}>
      <AppText
        style={{
          color: muted ? theme.textSecondary : theme.text,
          fontSize: strong ? 15 : 12,
          fontWeight: strong ? '700' : '400',
        }}
      >
        {label}
      </AppText>
      <AppText
        style={{
          color: muted ? theme.textSecondary : theme.text,
          fontSize: strong ? 17 : 12,
          fontWeight: strong ? '700' : '500',
          ...MONO,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}

function ActionChip({
  icon,
  label,
  onPress,
  disabled,
  tint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  const { theme } = useTheme();
  const color = tint ?? theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: theme.cardBackground,
        opacity: pressed || disabled ? 0.55 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}1a`,
        }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <AppText style={{ color: theme.text, fontSize: 12, fontWeight: '500' }}>{label}</AppText>
    </Pressable>
  );
}

/**
 * Receipt laid out like a supermarket bill: centred shop header, one line per
 * item with qty × rate and amount, dashed rules, totals on the right. Fits a
 * typical basket without scrolling; actions sit in one compact row below.
 */
export default function BillReceiptScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const result = useQuery(
    useCallback(() => storageService.getReceiptData(route.params.billId), [route.params.billId])
  );
  const action = useAction();
  const r = result.data;
  const money = (n: number) => formatCurrency(n, r?.currencyCode);
  const share = () =>
    action.run(async () => {
      if (!r) return;
      const file = await Print.printToFileAsync({ html: createReceiptHtml(r) });
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Share receipt' });
    });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: r ? `Receipt ${r.saleNumber.split('-').pop()}` : 'Receipt',
      headerRight: () =>
        r ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Printer settings"
            onPress={() => navigation.navigate('Printer')}
            hitSlop={8}
            style={{ padding: 8 }}
          >
            <Ionicons name="settings-outline" size={22} color={theme.primary} />
          </Pressable>
        ) : null,
    });
  }, [navigation, theme.primary, r]);

  const due = r?.due ?? 0;
  const change = r?.change ?? 0;
  const items = r?.items ?? [];
  const units = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <AppScreen theme={theme} contentStyle={{ paddingTop: 10 }}>
      <Notice message={result.error || action.error} error onRetry={result.reload} />
      {result.loading ? (
        <Busy />
      ) : !r ? (
        <Copy>Receipt unavailable.</Copy>
      ) : (
        <>
          <View
            style={{
              backgroundColor: theme.cardBackground,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 12,
            }}
          >
            {/* Shop header */}
            <View style={{ alignItems: 'center', gap: 1 }}>
              <AppText style={{ color: theme.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' }}>
                {r.businessName}
              </AppText>
              {!!r.businessAddress && <Detail icon="location-outline" text={r.businessAddress} lines={2} />}
              {!!r.businessPhone && <Detail icon="call-outline" text={r.businessPhone} />}
              {!!r.gstin && (
                <AppText style={{ color: theme.textSecondary, fontSize: 11, textAlign: 'center' }}>
                  Tax ID {r.gstin}
                </AppText>
              )}
            </View>
            <Rule />
            <Line label={r.saleNumber} value={r.date} muted />
            <Line label={r.customerPhone ? `${r.customerName} · ${r.customerPhone}` : r.customerName} value={`${items.length} items · ${units} qty`} muted />
            <Rule />
            {/* Column headings */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              <AppText style={[styles.th, { color: theme.textSecondary, flex: 1 }]}>ITEM</AppText>
              <AppText style={[styles.th, { color: theme.textSecondary, width: 44, textAlign: 'right' }]}>QTY</AppText>
              <AppText style={[styles.th, { color: theme.textSecondary, width: 68, textAlign: 'right' }]}>RATE</AppText>
              <AppText style={[styles.th, { color: theme.textSecondary, width: 76, textAlign: 'right' }]}>AMOUNT</AppText>
            </View>
            {items.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 }}>
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <AppText numberOfLines={1} style={{ color: theme.text, fontSize: 12, fontWeight: '500' }}>
                    {item.name}
                  </AppText>
                  {!!item.discount && (
                    <AppText style={{ color: theme.textSecondary, fontSize: 10 }}>
                      less {money(item.discount)}
                    </AppText>
                  )}
                </View>
                <AppText style={[styles.td, { color: theme.text, width: 44 }]}>
                  {item.quantity}
                  {item.unit && item.unit !== 'piece' ? ` ${item.unit}` : ''}
                </AppText>
                <AppText style={[styles.td, { color: theme.textSecondary, width: 68 }]}>{money(item.unitPrice)}</AppText>
                <AppText style={[styles.td, { color: theme.text, width: 76, fontWeight: '500' }]}>{money(item.total)}</AppText>
              </View>
            ))}
            <Rule />
            {(r.discount > 0 || r.tax > 0) && <Line label="Subtotal" value={money(r.subtotal)} />}
            {r.discount > 0 && <Line label="Discount" value={`- ${money(r.discount)}`} />}
            {r.tax > 0 && <Line label="Tax" value={money(r.tax)} />}
            <Line label="TOTAL" value={money(r.total)} strong />
            <View style={{ height: 4 }} />
            {r.payments?.length ? (
              r.payments.map((p, i) => (
                <Line key={i} label={`Paid by ${p.method}${p.reference ? ` · ${p.reference}` : ''}`} value={money(p.amount)} muted />
              ))
            ) : (
              <Line label="Payment" value="Pending" muted />
            )}
            {change > 0 && <Line label="Change returned" value={money(change)} muted />}
            {due > 0 && (
              <View style={{ marginTop: 6, padding: 8, borderRadius: 10, backgroundColor: theme.warningSoft }}>
                <Line label={`Balance due${r.dueDate ? ` by ${r.dueDate}` : ''}`} value={money(due)} />
              </View>
            )}
            <Rule />
            <AppText style={{ color: theme.textSecondary, fontSize: 11, textAlign: 'center' }}>
              {r.footerMessage || 'Thank you for shopping with us.'}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionChip icon="print" label="Print" disabled={action.busy} onPress={() => action.run(() => printReceipt(r))} />
            <ActionChip icon="share-outline" label="Share PDF" disabled={action.busy} onPress={share} />
            {due > 0 ? (
              <ActionChip
                icon="wallet"
                label="Collect"
                tint={theme.warning}
                onPress={() => navigation.navigate('Credit', { billId: r.saleId })}
              />
            ) : (
              <ActionChip
                icon="add-circle"
                label="New bill"
                tint={theme.success}
                onPress={() => navigation.navigate('Billing')}
              />
            )}
          </View>
        </>
      )}
    </AppScreen>
  );
}

const styles = {
  th: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5 },
  td: { fontSize: 12, textAlign: 'right' as const, ...MONO },
};
