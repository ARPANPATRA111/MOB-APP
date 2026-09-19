import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText } from "../../contexts/TypographyContext";
import type { Theme } from "../../contexts/ThemeContext";

export interface TrendChartPoint {
  label: string;
  key: string;
  value: number;
  highlighted?: boolean;
}
interface Props {
  theme: Theme;
  data: TrendChartPoint[];
  height?: number;
  valueFormatter?: (value: number) => string;
  accessibilityLabel?: string;
}

/** Rounds a chart ceiling to a friendly number (1, 2, 5 × 10ⁿ). */
const niceCeiling = (max: number) => {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const scaled = max / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
};

/**
 * Compact bar chart: three light gridlines with axis labels, rounded bars,
 * and a value bubble above the selected bar. Tapping a bar selects it; the
 * highlighted point (e.g. today) is selected by default.
 */
export default function TrendChart({
  theme,
  data,
  height = 120,
  valueFormatter = String,
  accessibilityLabel,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  useEffect(() => setSelected(null), [data]);
  const rawMax = Math.max(...data.map((p) => p.value), 0);
  const ceiling = niceCeiling(rawMax);
  const active =
    data.find((p) => p.key === selected) ??
    data.find((p) => p.highlighted) ??
    data[data.length - 1];
  const axisWidth = 34;
  const plotHeight = height - 22;
  const gap = 4;
  const activeIndex = active ? data.indexOf(active) : -1;
  const columnWidth = data.length ? (plotWidth - gap * (data.length - 1)) / data.length : 0;
  const bubbleWidth = 88;
  // Bubble centre over the active bar, clamped so it never leaves the plot.
  const bubbleLeft = Math.min(
    Math.max(activeIndex * (columnWidth + gap) + columnWidth / 2 - bubbleWidth / 2, 0),
    Math.max(plotWidth - bubbleWidth, 0),
  );
  const activeHeight = active ? Math.max(3, (active.value / ceiling) * (plotHeight - 2)) : 0;
  return (
    <View accessibilityLabel={accessibilityLabel} style={{ paddingTop: 22 }}>
      <View style={{ height: plotHeight, flexDirection: "row" }}>
        <View style={{ width: axisWidth, height: plotHeight, justifyContent: "space-between" }}>
          {[1, 0.5, 0].map((n) => (
            <AppText key={n} style={{ color: theme.placeholder, fontSize: 9, lineHeight: 10 }}>
              {n ? (rawMax > 0 ? valueFormatter(ceiling * n) : "") : "0"}
            </AppText>
          ))}
        </View>
        <View
          style={{ flex: 1, height: plotHeight }}
          onLayout={(e) => setPlotWidth(e.nativeEvent.layout.width)}
        >
          {[0, 0.5, 1].map((n) => (
            <View
              key={n}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: n * (plotHeight - 1),
                height: 1,
                backgroundColor: theme.chartGrid,
              }}
            />
          ))}
          <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap }}>
            {data.map((point) => {
              const isActive = active?.key === point.key;
              const barHeight = Math.max(3, (point.value / ceiling) * (plotHeight - 2));
              return (
                <Pressable
                  key={point.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${point.key}: ${valueFormatter(point.value)}`}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setSelected(point.key)}
                  style={{ flex: 1, height: plotHeight, justifyContent: "flex-end", alignItems: "center" }}
                >
                  <View
                    style={{
                      height: barHeight,
                      width: "100%",
                      maxWidth: 28,
                      borderRadius: 5,
                      backgroundColor: isActive ? theme.primary : point.value ? theme.chartBarMuted : theme.chartGrid,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          {active && plotWidth > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: bubbleLeft,
                width: bubbleWidth,
                bottom: activeHeight + 4,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: theme.text,
                }}
              >
                <AppText numberOfLines={1} style={{ color: theme.background, fontSize: 10, fontWeight: "600" }}>
                  {valueFormatter(active.value)}
                </AppText>
              </View>
            </View>
          )}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 6, marginLeft: axisWidth }}>
        {data.map((point, index) => (
          <AppText
            key={point.key}
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 10,
              textAlign: "center",
              color: active?.key === point.key ? theme.text : theme.textSecondary,
              fontWeight: active?.key === point.key ? "600" : "400",
            }}
          >
            {data.length <= 8 || index % Math.ceil(data.length / 8) === 0 ? point.label : ""}
          </AppText>
        ))}
      </View>
    </View>
  );
}
