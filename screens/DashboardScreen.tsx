import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { AppNavigation } from '../App';
import { Theme, useTheme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { useToast } from '../src/components/ui/ToastProvider';
import { APP_NAME } from '../src/domain/branding';
import { buildDashboardSummary, type DashboardSummary } from '../src/domain/dashboard';
import { storageService } from '../src/services/storage';
import { billingSession } from '../src/services/billingSession';
import type { Bill, InventoryItem } from '../src/types';
import AppButton from '../src/components/ui/AppButton';
import AppEmptyState from '../src/components/ui/AppEmptyState';
import AppScreen from '../src/components/ui/AppScreen';
import DeltaChip from '../src/components/ui/DeltaChip';
import QuickActionTile from '../src/components/ui/QuickActionTile';
import TrendChart from '../src/components/ui/TrendChart';
import { SkeletonCard, SkeletonLines, useDelayedFlag } from '../src/components/ui/Skeleton';
import { typography } from '../src/theme/typography';

type DashboardScreenProps = {
  navigation: AppNavigation;
};

interface DashboardState {
  loading: boolean;
  summary: DashboardSummary;
  recentBills: Bill[];
}

const emptySummary: DashboardSummary = {
  totalProducts: 0,
  lowStockCount: 0,
  todaysBills: 0,
  revenueToday: 0,
  itemsSoldToday: 0,
  revenueYesterday: 0,
  revenueChangePercent: null,
  averageBillToday: 0,
  salesTrend: [],
};

const EXIT_WINDOW_MS = 1800;
const RECENT_BILL_LIMIT = 4;

const greeting = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 17 ? 'Good afternoon' : 'Good evening';
};

const paymentIcon = (method: string): keyof typeof Ionicons.glyphMap => {
  const normalized = method.toLowerCase();
  if (normalized.includes('cash')) {
    return 'cash-outline';
  }
  if (normalized.includes('card')) {
    return 'card-outline';
  }
  return 'qr-code-outline';
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const currency = useCurrency();
  const toast = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const lastBackPressRef = useRef(0);
  const [state, setState] = useState<DashboardState>({
    loading: true,
    summary: emptySummary,
    recentBills: [],
  });
  const [refreshing, setRefreshing] = useState(false);
  const showSkeleton = useDelayedFlag(state.loading);

  const loadDashboard = useCallback(async () => {
    const [inventory, bills, lowStock] = await Promise.all([
      storageService.getInventory(),
      storageService.getBills(),
      storageService.getLowStockProducts(),
    ]);
    const today = new Date();
    const recentBills = [...bills]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, RECENT_BILL_LIMIT);

    setState({
      loading: false,
      summary: buildDashboardSummary(inventory, bills, lowStock as InventoryItem[], today),
      recentBills,
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Pick up a currency change made in Settings in the same gesture.
      await Promise.all([loadDashboard(), currency.refresh()]);
    } catch (error) {
      console.error('Dashboard refresh failed:', error);
      toast.showToast({ message: 'Could not refresh right now', variant: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [currency, loadDashboard, toast]);

  useEffect(() => {
    void loadDashboard();
    const unsubscribe = navigation.addListener('focus', () => {
      void loadDashboard();
    });
    return unsubscribe;
  }, [loadDashboard, navigation]);

  // Press-back-twice-to-exit, bound to focus rather than mount. Inside a tab
  // navigator this screen stays mounted while other tabs are showing, and this
  // handler returns `true` unconditionally — left on mount it would swallow the
  // back press on every tab and offer to exit instead of returning Home.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        const now = Date.now();
        if (now - lastBackPressRef.current < EXIT_WINDOW_MS) {
          BackHandler.exitApp();
          return true;
        }
        lastBackPressRef.current = now;
        toast.showToast({ message: 'Press back again to exit MOB', variant: 'neutral', duration: EXIT_WINDOW_MS });
        return true;
      });

      return () => subscription.remove();
    }, [toast])
  );

  const startNewBill = () => {
    billingSession.clear();
    navigation.navigate('Billing');
  };

  const { summary, recentBills } = state;
  const trendData = useMemo(
    () =>
      summary.salesTrend.map((point) => ({
        key: point.day,
        label: point.label,
        value: point.revenue,
        highlighted: point.isToday,
      })),
    [summary.salesTrend]
  );

  return (
    <AppScreen
      theme={theme}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.primary]}
          tintColor={theme.primary}
          progressBackgroundColor={theme.cardBackground}
        />
      )}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarCopy}>
          <Text style={styles.greeting}>{greeting(new Date())}</Text>
          <Text style={styles.appName} numberOfLines={1}>{APP_NAME}</Text>
        </View>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              summary.lowStockCount > 0
                ? `Alerts, ${summary.lowStockCount} low stock`
                : 'Alerts'
            }
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.text} />
            {summary.lowStockCount > 0 ? <View style={styles.dot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {state.loading ? (
        showSkeleton ? (
          <View>
            <SkeletonCard theme={theme} height={220} style={styles.skeletonHero} />
            <View style={styles.tileRow}>
              <SkeletonCard theme={theme} style={{ flex: 1 }} />
              <SkeletonCard theme={theme} style={{ flex: 1 }} />
            </View>
            <SkeletonLines theme={theme} lines={4} style={{ marginTop: 16 }} />
          </View>
        ) : null
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroLabel}>Today&apos;s sales</Text>
              <TouchableOpacity
                style={styles.heroLink}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Reports')}
                accessibilityRole="button"
                accessibilityLabel="Open reports"
              >
                <Text style={styles.heroLinkText}>Reports</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
              {currency.formatShort(summary.revenueToday)}
            </Text>
            <DeltaChip theme={theme} percent={summary.revenueChangePercent} caption="vs yesterday" />

            <View style={styles.heroMetrics}>
              <HeroMetric styles={styles} label="Bills" value={`${summary.todaysBills}`} />
              <View style={styles.heroMetricDivider} />
              <HeroMetric styles={styles} label="Items sold" value={`${summary.itemsSoldToday}`} />
              <View style={styles.heroMetricDivider} />
              <HeroMetric
                styles={styles}
                label="Avg bill"
                value={currency.formatShort(summary.averageBillToday)}
              />
            </View>

            <View style={styles.chartWrap}>
              <Text style={styles.chartCaption}>Last 7 days</Text>
              <TrendChart
                theme={theme}
                data={trendData}
                valueFormatter={currency.formatCompact}
                accessibilityLabel={`Revenue over the last 7 days. ${summary.salesTrend
                  .map((point) => `${point.label} ${currency.formatShort(point.revenue)}`)
                  .join(', ')}.`}
              />
            </View>
          </View>

          {summary.totalProducts === 0 ? (
            <View style={styles.startCard}>
              <View style={styles.startIconWell}>
                <Ionicons name="rocket-outline" size={22} color={theme.primary} />
              </View>
              <Text style={styles.startTitle}>Set up your shop</Text>
              <Text style={styles.startBody}>
                Add the products you sell, then bill customers by scanning or searching them. Everything
                stays on this device — no account needed.
              </Text>
              <AppButton
                label="Add your first product"
                theme={theme}
                onPress={() => navigation.navigate('AddItem')}
              />
            </View>
          ) : null}

          {summary.lowStockCount > 0 ? (
            <TouchableOpacity
              style={styles.alertBanner}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Notifications')}
              accessibilityRole="button"
              accessibilityLabel={`${summary.lowStockCount} products are low on stock. Review them.`}
            >
              <Ionicons name="alert-circle" size={20} color={theme.warning} />
              <Text style={styles.alertText} numberOfLines={2}>
                {summary.lowStockCount} {summary.lowStockCount === 1 ? 'product is' : 'products are'} running low on stock
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.warning} />
            </TouchableOpacity>
          ) : null}

          <Text style={styles.sectionTitle}>Manage</Text>
          <View style={styles.tileRow}>
            <QuickActionTile
              theme={theme}
              icon="cube-outline"
              label="Inventory"
              hint={`${summary.totalProducts} products`}
              onPress={() => navigation.navigate('Inventory')}
            />
            <QuickActionTile
              theme={theme}
              icon="alert-circle-outline"
              label="Low stock"
              hint={summary.lowStockCount > 0 ? 'Needs attention' : 'All stocked'}
              badge={summary.lowStockCount || undefined}
              badgeTone="warning"
              onPress={() => navigation.navigate('Notifications')}
            />
          </View>
          <View style={styles.tileRow}>
            <QuickActionTile
              theme={theme}
              icon="stats-chart-outline"
              label="Reports"
              hint="Sales & insights"
              onPress={() => navigation.navigate('Reports')}
            />
            <QuickActionTile
              theme={theme}
              icon="receipt-outline"
              label="Orders"
              hint="Past bills"
              onPress={() => navigation.navigate('RecentActivity')}
            />
          </View>

          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent orders</Text>
            {recentBills.length > 0 ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('RecentActivity')}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.link}>View all</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {recentBills.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppEmptyState
                theme={theme}
                title="No bills yet"
                message="Ring up your first sale and it will show up here."
              />
              <View style={styles.emptyCardAction}>
                <AppButton label="Start a bill" theme={theme} onPress={startNewBill} />
              </View>
            </View>
          ) : (
            <View style={styles.list}>
              {recentBills.map((bill, index) => (
                <TouchableOpacity
                  key={bill.id}
                  style={[styles.listRow, index > 0 && styles.listRowDivided]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('BillReceipt', { billId: bill.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Bill for ${bill.customerName || 'walk-in customer'}, ${currency.formatShort(bill.total)}`}
                >
                  <View style={styles.listIcon}>
                    <Ionicons name={paymentIcon(bill.paymentMethod)} size={17} color={theme.primary} />
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {bill.customerName || 'Walk-in customer'}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {new Date(bill.timestamp).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' · '}
                      {bill.paymentMethod}
                    </Text>
                  </View>
                  <Text style={styles.amount}>{currency.formatShort(bill.total)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </AppScreen>
  );
};

type DashboardStyles = ReturnType<typeof createStyles>;

const HeroMetric = ({
  styles,
  label,
  value,
}: {
  styles: DashboardStyles;
  label: string;
  value: string;
}) => (
  <View style={styles.heroMetric}>
    <Text style={styles.heroMetricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.heroMetricLabel} numberOfLines={1}>{label}</Text>
  </View>
);

const createStyles = (theme: Theme) => StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  topBarCopy: { flex: 1 },
  greeting: { color: theme.textSecondary, ...typography.caption, fontWeight: '600' },
  appName: { color: theme.text, ...typography.screenTitle, marginTop: 2 },
  topBarActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.divider,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.danger,
    borderWidth: 1.5,
    borderColor: theme.cardBackground,
  },

  skeletonHero: { marginBottom: 12 },

  heroCard: {
    backgroundColor: theme.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.divider,
    padding: 18,
    marginBottom: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    color: theme.textSecondary,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroLinkText: { color: theme.primary, ...typography.caption, fontWeight: '700' },
  heroValue: {
    color: theme.text,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 6,
    marginBottom: 8,
  },

  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  heroMetric: { flex: 1, alignItems: 'center' },
  heroMetricDivider: { width: 1, height: 26, backgroundColor: theme.divider },
  heroMetricValue: { color: theme.text, ...typography.bodyStrong, fontSize: 17 },
  heroMetricLabel: { color: theme.textSecondary, ...typography.caption, fontWeight: '500', marginTop: 2 },

  chartWrap: { marginTop: 18 },
  chartCaption: {
    color: theme.textSecondary,
    ...typography.caption,
    fontWeight: '500',
    marginBottom: 10,
  },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: theme.warningSoft,
    marginBottom: 12,
  },
  alertText: { flex: 1, color: theme.warning, ...typography.caption, fontSize: 13, lineHeight: 18 },

  sectionTitle: { color: theme.text, ...typography.sectionTitle, fontSize: 17, marginBottom: 10 },
  tileRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  link: { color: theme.primary, ...typography.caption, fontSize: 13, fontWeight: '700' },

  emptyCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingBottom: 16,
  },
  emptyCardAction: { paddingHorizontal: 16 },
  list: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listRowDivided: { borderTopWidth: 1, borderTopColor: theme.divider },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primarySoft,
  },
  listCopy: { flex: 1 },
  listTitle: { color: theme.text, ...typography.bodyStrong },
  listMeta: { color: theme.textSecondary, ...typography.caption, fontWeight: '500', marginTop: 1 },
  amount: { color: theme.text, ...typography.bodyStrong },

  startCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.divider,
    padding: 18,
    marginBottom: 12,
    gap: 10,
  },
  startIconWell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primarySoft,
  },
  startTitle: { color: theme.text, ...typography.sectionTitle, fontSize: 17 },
  startBody: { color: theme.textSecondary, ...typography.body, marginBottom: 4 },
});

export default DashboardScreen;
