import React, { useCallback, useLayoutEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AppScreen from "../src/components/ui/AppScreen";
import TrendChart from "../src/components/ui/TrendChart";
import {
  Busy,
  Choices,
  Copy,
  EmptyState,
  Group,
  ListRow,
  Notice,
  Panel,
  Stat,
  useAction,
  useQuery,
} from "../src/components/ui/CommerceUI";
import { AppText } from "../src/contexts/TypographyContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useCurrency } from "../src/contexts/CurrencyContext";
import { groupSalesForChart, shortDay } from "../src/domain/chart";
import { getPresetRange, type ReportPreset } from "../src/domain/reports";
import { reportHtml } from "../src/domain/reportExport";
import { getReport } from "../src/repositories/reportRepository";

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const METHOD_COLORS: Record<string, string> = {
  Cash: "#34c759",
  UPI: "#5856d6",
  Card: "#0a7aff",
};

export default function ReportsScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const action = useAction();
  const [preset, setPreset] = useState<ReportPreset | "custom">("last7Days");
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d;
  });
  const [end, setEnd] = useState(new Date());
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [details, setDetails] = useState(false);
  const [top, setTop] = useState<"revenue" | "quantity">("revenue");
  const result = useQuery(
    useCallback(async () => {
      const a = new Date(start);
      a.setHours(0, 0, 0, 0);
      const b = new Date(end);
      b.setHours(23, 59, 59, 999);
      const range =
        preset === "custom"
          ? { start: Math.min(a.getTime(), b.getTime()), end: Math.max(a.getTime(), b.getTime()) }
          : getPresetRange(preset);
      const label =
        preset === "today"
          ? "Today"
          : `${shortDay(dayKey(new Date(range.start)))} – ${shortDay(dayKey(new Date(range.end)))}`;
      return { range, report: await getReport(range.start, range.end, label) };
    }, [preset, start, end]),
  );
  const r = result.data?.report;
  const range = result.data?.range;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        r ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share report PDF"
            disabled={action.busy}
            onPress={() =>
              action.run(async () => {
                const file = await Print.printToFileAsync({ html: reportHtml(r, currency.code) });
                await Sharing.shareAsync(file.uri, {
                  mimeType: "application/pdf",
                  dialogTitle: "Share shop report",
                });
              })
            }
            hitSlop={8}
            style={{ padding: 8, opacity: action.busy ? 0.4 : 1 }}
          >
            <Ionicons name="share-outline" size={24} color={theme.primary} />
          </Pressable>
        ) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, theme.primary, r, action.busy, currency.code]);

  const collected = r?.payments.reduce((n, p) => n + p.total, 0) ?? 0;

  return (
    <AppScreen theme={theme} contentStyle={{ paddingTop: 6 }}>
      <View style={{ marginBottom: 14, gap: 10 }}>
        <Choices
          value={preset}
          options={[
            { value: "today", label: "Today" },
            { value: "last7Days", label: "7 days" },
            { value: "thisMonth", label: "Month" },
            { value: "custom", label: "Custom" },
          ]}
          onChange={(value) => setPreset(value as ReportPreset | "custom")}
        />
        {preset === "custom" && (
          <Group>
            <ListRow title="From" trailing={start.toLocaleDateString()} onPress={() => setPicker("start")} />
            <ListRow title="To" trailing={end.toLocaleDateString()} onPress={() => setPicker("end")} />
          </Group>
        )}
        {picker && (
          <DateTimePicker
            value={picker === "start" ? start : end}
            mode="date"
            maximumDate={new Date()}
            onChange={(e, date) => {
              const target = picker;
              setPicker(null);
              if (e.type === "set" && date) (target === "start" ? setStart : setEnd)(date);
            }}
          />
        )}
      </View>
      <Notice message={result.error || action.error} error onRetry={result.reload} />
      {result.loading && !r ? (
        <Busy />
      ) : (
        r && (
          <>
            <Panel>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Stat
                  label={r.label}
                  value={currency.format(r.totalSales)}
                  caption={`${r.totalBills} ${r.totalBills === 1 ? "bill" : "bills"} · ${r.totalItems} items`}
                />
                {r.totalBills > 0 && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Stat
                      label="Avg bill"
                      value={currency.formatShort(r.totalSales / r.totalBills)}
                    />
                  </View>
                )}
              </View>
              {r.totalBills > 0 || preset !== "today" ? (
                <TrendChart
                  theme={theme}
                  height={130}
                  data={groupSalesForChart(r.dailySalesTrend)}
                  valueFormatter={currency.formatShort}
                />
              ) : null}
            </Panel>
            {r.totalBills === 0 ? (
              <EmptyState icon="stats-chart-outline" title="No sales in this period" />
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                  <View style={{ flex: 1, backgroundColor: theme.cardBackground, borderRadius: 14, padding: 12 }}>
                    <Stat
                      label="Profit"
                      value={currency.formatShort(r.knownProfit)}
                      caption={
                        r.missingCostLines > 0
                          ? `${r.missingCostLines} items without buying cost`
                          : r.knownNetSales
                            ? `${((r.knownProfit / r.knownNetSales) * 100).toFixed(0)}% margin`
                            : "Add buying costs to see profit"
                      }
                      color={r.knownProfit >= 0 ? theme.success : theme.danger}
                    />
                  </View>
                  <View style={{ flex: 1, backgroundColor: theme.cardBackground, borderRadius: 14, padding: 12 }}>
                    <Stat
                      label="Received"
                      value={currency.formatShort(r.collections)}
                      caption={r.outstanding > 0 ? `${currency.formatShort(r.outstanding)} still unpaid` : "All bills paid"}
                    />
                  </View>
                </View>
                {r.payments.length > 0 && (
                  <Panel title="How customers paid">
                    <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 }}>
                      {r.payments.map((p) => (
                        <View
                          key={p.method}
                          style={{
                            flex: Math.max(p.total, 0.01),
                            backgroundColor: METHOD_COLORS[p.method] ?? theme.chartBarMuted,
                          }}
                        />
                      ))}
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                      {r.payments.map((p) => (
                        <View key={p.method} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: METHOD_COLORS[p.method] ?? theme.chartBarMuted,
                            }}
                          />
                          <AppText style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>
                            {currency.formatShort(p.total)}
                          </AppText>
                          <AppText style={{ color: theme.textSecondary, fontSize: 12 }}>
                            {p.method} · {collected ? Math.round((p.total / collected) * 100) : 0}%
                          </AppText>
                        </View>
                      ))}
                    </View>
                  </Panel>
                )}
                <Group title="Top products">
                  <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Choices<"revenue" | "quantity">
                      compact
                      value={top}
                      onChange={setTop}
                      options={[
                        { value: "revenue", label: "By sales" },
                        { value: "quantity", label: "By quantity" },
                      ]}
                    />
                  </View>
                  {(top === "revenue" ? r.topProductsByRevenue : r.topProductsByQuantity)
                    .slice(0, 5)
                    .map((p, index) => (
                      <ListRow
                        key={p.id}
                        title={`${index + 1}. ${p.name}`}
                        subtitle={`${p.quantity} sold`}
                        trailing={currency.formatShort(p.totalSales)}
                        onPress={() => navigation.navigate("RecentActivity", { ...range, productId: p.id })}
                      />
                    ))}
                </Group>
                <Group>
                  <ListRow
                    icon="receipt"
                    iconColor="#ff2d55"
                    title="Receipts in this period"
                    trailing={String(r.totalBills)}
                    onPress={() => navigation.navigate("RecentActivity", range)}
                  />
                  {r.outstanding > 0 && (
                    <ListRow
                      icon="wallet"
                      iconColor="#ff9500"
                      title="Unpaid customer bills"
                      trailing={currency.format(r.outstanding)}
                      onPress={() => navigation.navigate("Credit")}
                    />
                  )}
                  <ListRow
                    icon="ellipsis-horizontal"
                    iconColor="#8e8e93"
                    title="More details"
                    chevron={false}
                    onPress={() => setDetails(!details)}
                    right={<Ionicons name={details ? "chevron-up" : "chevron-down"} size={18} color={theme.placeholder} />}
                  />
                  {details ? <ListRow title="Discounts given" trailing={currency.format(r.discounts)} /> : null}
                  {details ? <ListRow title="Tax collected" trailing={currency.format(r.tax)} /> : null}
                  {details ? <ListRow title="Stock value at cost" trailing={currency.format(r.inventoryValue)} /> : null}
                </Group>
                {details && r.unknownCostProducts > 0 && (
                  <Copy muted>
                    Stock value excludes {r.unknownCostProducts} products without a buying cost.
                  </Copy>
                )}
              </>
            )}
          </>
        )
      )}
    </AppScreen>
  );
}
