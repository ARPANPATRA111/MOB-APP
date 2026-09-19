import React, { useCallback } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import AppScreen from "../src/components/ui/AppScreen";
import TrendChart from "../src/components/ui/TrendChart";
import { AppText } from "../src/contexts/TypographyContext";
import {
  Busy,
  Copy,
  Group,
  ListRow,
  Notice,
  Panel,
  useQuery,
} from "../src/components/ui/CommerceUI";
import { useTheme } from "../src/contexts/ThemeContext";
import { useCurrency } from "../src/contexts/CurrencyContext";
import { formatCurrency } from "../src/domain/currency";
import { shortDay } from "../src/domain/chart";
import { getDashboardSummary } from "../src/repositories/reportRepository";
import { searchReceipts } from "../src/repositories/saleRepository";
import { getCreditSummary } from "../src/repositories/creditRepository";
import {
  getBusinessProfile,
  getSetting,
} from "../src/repositories/settingsRepository";
import { useCheckoutDraft } from "../src/services/billingSession";

function Tile({
  label,
  value,
  caption,
  icon,
  tint,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  caption: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tint: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: 12,
        borderRadius: 14,
        backgroundColor: theme.cardBackground,
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={15} color={tint} />
        <AppText style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "500" }}>
          {label}
        </AppText>
      </View>
      <AppText
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: theme.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.4, fontVariant: ["tabular-nums"] }}
      >
        {value}
      </AppText>
      <AppText style={{ color: theme.textSecondary, fontSize: 12 }}>{caption}</AppText>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <AppText style={{ color: theme.textSecondary, fontSize: 11, fontWeight: "500" }}>{label}</AppText>
      <AppText
        numberOfLines={1}
        style={{ color: theme.text, fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}
      >
        {value}
      </AppText>
    </View>
  );
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const draft = useCheckoutDraft();
  const result = useQuery(
    useCallback(async () => {
      const [summary, receipts, credit, profile, migrationWarning] =
        await Promise.all([
          getDashboardSummary(),
          searchReceipts(),
          getCreditSummary(),
          getBusinessProfile(),
          getSetting("legacy_migration_needs_review", false),
        ]);
      return {
        summary,
        receipts: receipts.slice(0, 3),
        credit,
        profile,
        migrationWarning,
      };
    }, []),
  );
  const data = result.data;
  const s = data?.summary;
  const weekTotal = s?.salesTrend.reduce((n, p) => n + p.revenue, 0) ?? 0;
  const delta = s?.revenueChangePercent ?? null;
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return (
    <AppScreen
      theme={theme}
      refreshControl={
        <RefreshControl
          refreshing={result.loading}
          onRefresh={result.reload}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 12,
          marginBottom: 12,
          marginTop: 2,
        }}
      >
        <AppText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            flex: 1,
            color: theme.text,
            fontSize: 28,
            fontWeight: "800",
            letterSpacing: -0.8,
          }}
        >
          {data?.profile?.businessName || "My shop"}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Stock alerts"
          onPress={() => navigation.navigate("Notifications")}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.cardBackground,
            opacity: pressed ? 0.6 : 1,
            marginBottom: 2,
          })}
        >
          <Ionicons name="notifications-outline" size={20} color={theme.text} />
          {!!s?.lowStockCount && (
            <View
              style={{
                position: "absolute",
                top: 8,
                right: 9,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.danger,
              }}
            />
          )}
        </Pressable>
      </View>
      <Notice message={result.error} error onRetry={result.reload} />
      {data?.migrationWarning && (
        <Notice
          error
          message="Some older records need review. Their original data is preserved; see Settings before correcting them."
        />
      )}
      {draft.cart.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue the open bill"
          onPress={() => navigation.navigate("Billing")}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 12,
            borderRadius: 14,
            marginBottom: 14,
            backgroundColor: theme.primarySoft,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="cart" size={20} color={theme.primary} />
          <AppText style={{ flex: 1, color: theme.primary, fontSize: 14, fontWeight: "600" }}>
            Open bill · {draft.cart.length} {draft.cart.length === 1 ? "item" : "items"}
          </AppText>
          <AppText style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>Continue</AppText>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </Pressable>
      )}
      {result.loading && !data ? (
        <Busy />
      ) : (
        data &&
        s && (
          <>
            <Panel>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ gap: 2 }}>
                  <AppText style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "500" }}>
                    Sales today · {today}
                  </AppText>
                  <AppText
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{
                      color: theme.text,
                      fontSize: 30,
                      fontWeight: "800",
                      letterSpacing: -0.9,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {currency.format(s.revenueToday)}
                  </AppText>
                </View>
                {delta !== null && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 3,
                      paddingHorizontal: 8,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: delta >= 0 ? theme.successSoft : theme.dangerSoft,
                    }}
                  >
                    <Ionicons
                      name={delta >= 0 ? "trending-up" : "trending-down"}
                      size={14}
                      color={delta >= 0 ? theme.success : theme.danger}
                    />
                    <AppText
                      style={{
                        color: delta >= 0 ? theme.success : theme.danger,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {Math.abs(delta).toFixed(0)}% vs yesterday
                    </AppText>
                  </View>
                )}
              </View>
              <View style={{ height: 0.5, backgroundColor: theme.divider }} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <MiniStat label="Bills" value={String(s.todaysBills)} />
                <MiniStat label="Items sold" value={String(s.itemsSoldToday)} />
                <MiniStat label="Avg bill" value={s.todaysBills ? currency.formatShort(s.averageBillToday) : "–"} />
              </View>
            </Panel>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <Tile
                label="Stock"
                icon="cube"
                tint={theme.primary}
                value={String(s.totalProducts)}
                caption={s.lowStockCount ? `${s.lowStockCount} running low` : "All stocked"}
                onPress={() => navigation.navigate("Inventory")}
                accessibilityLabel="View stock"
              />
              <Tile
                label="To collect"
                icon="wallet"
                tint={theme.warning}
                value={currency.formatShort((data.credit?.due_cents ?? 0) / 100)}
                caption={`${data.credit?.count ?? 0} unpaid ${data.credit?.count === 1 ? "bill" : "bills"}`}
                onPress={() => navigation.navigate("Credit")}
                accessibilityLabel="Collect customer credit"
              />
            </View>
            <Panel>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>Last 7 days</AppText>
                <AppText style={{ color: theme.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {currency.formatShort(weekTotal)}
                </AppText>
              </View>
              <TrendChart
                theme={theme}
                height={110}
                data={s.salesTrend.map((p) => ({
                  key: shortDay(p.day),
                  label: p.label,
                  value: p.revenue,
                  highlighted: p.isToday,
                }))}
                valueFormatter={currency.formatShort}
              />
            </Panel>
            <Group title="Latest receipts">
              {data.receipts.length ? (
                data.receipts.map((r) => (
                  <ListRow
                    key={r.id}
                    title={r.customer_name || "Walk-in"}
                    subtitle={new Date(r.sale_date).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    trailing={formatCurrency(r.total_cents / 100, r.currency_code)}
                    onPress={() =>
                      navigation.navigate("BillReceipt", { billId: r.id })
                    }
                  />
                ))
              ) : (
                <View style={{ padding: 14 }}>
                  <Copy muted>Your first sale will appear here.</Copy>
                </View>
              )}
              <ListRow
                title="All receipts"
                onPress={() => navigation.navigate("RecentActivity")}
              />
            </Group>
            <Group>
              <ListRow
                icon="stats-chart"
                iconColor="#0a7aff"
                title="Reports"
                subtitle="Sales, profit and top products"
                onPress={() => navigation.navigate("Reports")}
              />
              <ListRow
                icon="grid"
                iconColor="#34c759"
                title="Manage shop"
                subtitle="Parked bills, purchases, suppliers, credit"
                onPress={() => navigation.navigate("Management")}
              />
            </Group>
          </>
        )
      )}
    </AppScreen>
  );
}
