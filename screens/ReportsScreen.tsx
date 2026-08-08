import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { storageService } from '../src/services/storage';
import type { ReportPreset, SalesReportSummary } from '../src/domain/reports';
import AppBadge from '../src/components/ui/AppBadge';
import AppButton from '../src/components/ui/AppButton';
import AppCard from '../src/components/ui/AppCard';
import AppEmptyState from '../src/components/ui/AppEmptyState';
import AppScreen from '../src/components/ui/AppScreen';
import { Skeleton, useDelayedFlag } from '../src/components/ui/Skeleton';
import { useDialog } from '../src/components/ui/DialogProvider';
import BottomActionBar from '../src/components/ui/BottomActionBar';
import InsightBars from '../src/components/ui/InsightBars';
import SectionHeader from '../src/components/ui/SectionHeader';
import StatCard from '../src/components/ui/StatCard';
import { typography } from '../src/theme/typography';

type RangeMode = ReportPreset | 'custom';

const quickRanges: { label: string; value: RangeMode }[] = [
  { label: 'Today', value: 'today' },
  { label: '7 days', value: 'last7Days' },
  { label: 'Month', value: 'thisMonth' },
  { label: 'Custom', value: 'custom' },
];

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const buildReportHtml = (
  report: SalesReportSummary,
  label: string,
  formatCurrency: (value: number) => string
) => `
  <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
        h1 { margin: 0 0 4px; }
        .muted { color: #4b5563; font-size: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
        .card { border: 1px solid #d1d5db; padding: 12px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f3f4f6; text-transform: uppercase; font-size: 12px; }
        th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
        td:last-child, th:last-child { text-align: right; }
      </style>
    </head>
    <body>
      <h1>Sales Report</h1>
      <div class="muted">${escapeHtml(label)}</div>
      <div class="grid">
        <div class="card"><strong>Total sales</strong><br/>${formatCurrency(report.totalSales)}</div>
        <div class="card"><strong>Bills</strong><br/>${report.totalBills}</div>
        <div class="card"><strong>Items sold</strong><br/>${report.totalItems}</div>
        <div class="card"><strong>Average bill</strong><br/>${formatCurrency(report.averageBillValue)}</div>
      </div>
      <h2>Payment Modes</h2>
      <table>
        <thead><tr><th>Mode</th><th>Bills</th><th>Total</th></tr></thead>
        <tbody>${report.payments.map((payment) => `<tr><td>${escapeHtml(payment.method)}</td><td>${payment.count}</td><td>${formatCurrency(payment.total)}</td></tr>`).join('')}</tbody>
      </table>
      <h2>Top Products</h2>
      <table>
        <thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead>
        <tbody>${report.topProductsByRevenue.map((product) => `<tr><td>${escapeHtml(product.name)}</td><td>${product.quantity}</td><td>${formatCurrency(product.totalSales)}</td></tr>`).join('')}</tbody>
      </table>
    </body>
  </html>
`;

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const ReportsScreen: React.FC = () => {
  const { theme } = useTheme();
  const currency = useCurrency();
  const styles = createStyles(theme);
  const [rangeMode, setRangeMode] = useState<RangeMode>('today');
  const [customStart, setCustomStart] = useState(startOfDay(new Date()));
  const [customEnd, setCustomEnd] = useState(endOfDay(new Date()));
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);
  const [report, setReport] = useState<SalesReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const reqRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const dialog = useDialog();
  const showSkeleton = useDelayedFlag(loading);

  const label = useMemo(() => {
    if (rangeMode === 'today') {
      return 'Today';
    }
    if (rangeMode === 'last7Days') {
      return 'Last 7 days';
    }
    if (rangeMode === 'thisMonth') {
      return 'This month';
    }
    return `${customStart.toLocaleDateString()} - ${customEnd.toLocaleDateString()}`;
  }, [customEnd, customStart, rangeMode]);

  useEffect(() => {
    const requestId = ++reqRef.current;
    // Keep the current report on screen while a new range loads (no full-screen
    // remount). Only the very first load shows the skeleton; range switches show
    // a subtle inline "Updating" indicator. Stale responses are ignored.
    if (!hasLoadedRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    const loadReport = async () => {
      try {
        const data = rangeMode === 'custom'
          ? await storageService.getSalesReportForRange(customStart.getTime(), customEnd.getTime(), label)
          : await storageService.getSalesReportByPreset(rangeMode, new Date());
        if (reqRef.current === requestId) {
          setReport({ ...data, label });
          hasLoadedRef.current = true;
        }
      } catch (error) {
        console.error('Report load failed:', error);
        if (reqRef.current === requestId) {
          void dialog.alert({ title: 'Reports unavailable', message: 'Unable to load sales reports from the local database.' });
        }
      } finally {
        if (reqRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void loadReport();
  }, [customEnd, customStart, label, rangeMode, dialog]);

  const sharePdf = async () => {
    if (!report) {
      return;
    }
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildReportHtml(report, label, currency.format) });
      if (Platform.OS === 'android' && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: `Share ${label} report` });
      } else {
        await Share.share({ title: `${label} report`, url: uri });
      }
    } catch (error) {
      void dialog.alert({ title: 'Export failed', message: (error as Error).message });
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <AppScreen theme={theme} scroll={false}>
        {showSkeleton ? (
          <View style={{ paddingTop: 4 }}>
            <Skeleton theme={theme} height={44} radius={8} style={{ marginBottom: 12 }} />
            <View style={styles.statsGrid}>
              <Skeleton theme={theme} height={96} radius={16} style={{ flex: 1 }} />
              <Skeleton theme={theme} height={96} radius={16} style={{ flex: 1 }} />
            </View>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} theme={theme} height={120} radius={16} style={{ marginBottom: 12 }} />
            ))}
          </View>
        ) : null}
      </AppScreen>
    );
  }

  return (
    <AppScreen
      theme={theme}
      footer={report && report.totalBills > 0 ? (
        <BottomActionBar theme={theme}>
          <AppButton theme={theme} label="Share PDF Report" onPress={sharePdf} loading={sharing} />
        </BottomActionBar>
      ) : undefined}
    >
      <View style={styles.compactHeader}>
        <Text style={styles.subtitle}>
          {refreshing ? 'Updating…' : 'Sales, payments, stock & product movement'}
        </Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setDatePickerTarget('start')}>
          <MaterialIcons name="date-range" size={22} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.periodRow}>
        {quickRanges.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.periodPill, rangeMode === option.value && styles.periodPillActive]}
            onPress={() => setRangeMode(option.value)}
          >
            <Text style={[styles.periodText, rangeMode === option.value && styles.periodTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {rangeMode === 'custom' ? (
        <View style={styles.customRow}>
          <TouchableOpacity style={styles.customDate} onPress={() => setDatePickerTarget('start')}>
            <Text style={styles.customLabel}>From</Text>
            <Text style={styles.customValue}>{customStart.toLocaleDateString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.customDate} onPress={() => setDatePickerTarget('end')}>
            <Text style={styles.customLabel}>To</Text>
            <Text style={styles.customValue}>{customEnd.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {datePickerTarget ? (
        <DateTimePicker
          value={datePickerTarget === 'start' ? customStart : customEnd}
          mode="date"
          onChange={(_, date) => {
            if (date) {
              if (datePickerTarget === 'start') {
                setCustomStart(startOfDay(date));
              } else {
                setCustomEnd(endOfDay(date));
              }
              setRangeMode('custom');
            }
            setDatePickerTarget(null);
          }}
        />
      ) : null}

      {report && report.totalBills > 0 ? (
        <>
          <View style={styles.statsGrid}>
            <StatCard theme={theme} label="Sales" value={currency.format(report.totalSales)} hint={label} />
            <StatCard theme={theme} label="Bills" value={`${report.totalBills}`} hint={`Avg ${currency.format(report.averageBillValue)}`} />
          </View>
          <View style={styles.statsGrid}>
            <StatCard theme={theme} label="Items sold" value={`${report.totalItems}`} hint="Persisted sale items" />
            <StatCard theme={theme} label="Low stock" value={`${report.lowStock.length}`} hint="Needs attention" />
          </View>

          <AppCard theme={theme} style={styles.section}>
            <SectionHeader theme={theme} title="Daily sales trend" subtitle="Lightweight chart from saved bills" />
            <InsightBars
              theme={theme}
              data={report.dailySalesTrend.map((point) => ({
                label: point.label,
                value: point.sales,
                caption: `${point.bills} bills`,
              }))}
              valueFormatter={currency.format}
            />
          </AppCard>

          <AppCard theme={theme} style={styles.section}>
            <SectionHeader theme={theme} title="Payment breakdown" right={<AppBadge theme={theme} label={`${report.payments.length}`} />} />
            <InsightBars
              theme={theme}
              data={report.payments.map((payment) => ({
                label: payment.method,
                value: payment.total,
                caption: `${payment.count} payments - ${payment.percentage}%`,
              }))}
              valueFormatter={currency.format}
            />
          </AppCard>

          <AppCard theme={theme} style={styles.section}>
            <SectionHeader theme={theme} title="Most sold products" subtitle="By quantity" />
            <InsightBars
              theme={theme}
              data={report.topProductsByQuantity.slice(0, 8).map((product) => ({
                label: product.name,
                value: product.quantity,
                caption: currency.format(product.totalSales),
              }))}
            />
          </AppCard>

          <AppCard theme={theme} style={styles.section}>
            <SectionHeader theme={theme} title="Highest revenue products" subtitle="By sales amount" />
            <InsightBars
              theme={theme}
              data={report.topProductsByRevenue.slice(0, 8).map((product) => ({
                label: product.name,
                value: product.totalSales,
                caption: `${product.quantity} sold`,
              }))}
              valueFormatter={currency.format}
            />
          </AppCard>

          <AppCard theme={theme} style={styles.section}>
            <SectionHeader theme={theme} title="Low-stock products" right={<AppBadge theme={theme} label={`${report.lowStock.length}`} tone={report.lowStock.length ? 'warning' : 'success'} />} />
            {report.lowStock.length ? (
              report.lowStock.slice(0, 8).map((item) => (
                <View key={item.barcode} style={styles.row}>
                  <View style={styles.productInfo}>
                    <Text style={styles.rowLabel}>{item.name}</Text>
                    <Text style={styles.muted}>{item.barcode}</Text>
                  </View>
                  <AppBadge theme={theme} label={`${item.quantity} left`} tone="warning" />
                </View>
              ))
            ) : (
              <Text style={styles.muted}>No low-stock products in the current catalog.</Text>
            )}
          </AppCard>
        </>
      ) : (
        <AppCard theme={theme}>
          <AppEmptyState theme={theme} title="No sales in this range" message="Create a saved bill and it will appear here immediately." />
        </AppCard>
      )}
    </AppScreen>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  subtitle: { color: theme.textSecondary, ...typography.caption, flex: 1 },
  dateButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periodPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  periodPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  periodText: { color: theme.textSecondary, ...typography.caption },
  periodTextActive: { color: '#ffffff' },
  customRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  customDate: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.cardBackground,
    padding: 10,
  },
  customLabel: { color: theme.textSecondary, ...typography.caption },
  customValue: { color: theme.text, ...typography.bodyStrong, marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  section: { marginBottom: 12 },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    gap: 12,
    paddingVertical: 10,
  },
  productInfo: { flex: 1 },
  rowLabel: { color: theme.text, ...typography.bodyStrong },
  muted: { color: theme.textSecondary, ...typography.caption, marginTop: 2 },
});

export default ReportsScreen;
