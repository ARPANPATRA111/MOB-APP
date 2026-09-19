import React, { memo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../contexts/ThemeContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { AppText } from "../contexts/TypographyContext";
import type { ProductRecord } from "../repositories/productRepository";
import { thumbUriFor } from "../services/productImages";

const RADIUS = 14;

/**
 * One product line in a grouped table. `first`/`last` round the outer corners
 * so a flat list of rows reads as one inset card; rows are memoized because
 * inventories can run to thousands of items. In the cart picker, a line that
 * is already on the bill gets a green outline and a badge with its quantity.
 */
export default memo(function ProductRow({
  product: p,
  onPress,
  adding = false,
  first = false,
  last = false,
  cartQuantity = 0,
}: {
  product: ProductRecord;
  onPress: () => void;
  adding?: boolean;
  first?: boolean;
  last?: boolean;
  /** Units of this product already in the open bill; 0 when not in the cart. */
  cartQuantity?: number;
}) {
  const { theme } = useTheme();
  const currency = useCurrency();
  // Lists decode the 144 px thumbnail; older photos without one fall back to the main file.
  const [source, setSource] = useState<"thumb" | "main" | "none">("thumb");
  const uri = p.imageUri ? (source === "thumb" ? thumbUriFor(p.imageUri) : p.imageUri) : null;
  const low = p.stockQuantity <= p.lowStockThreshold;
  const out = p.stockQuantity <= 0;
  const inCart = cartQuantity > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${adding ? "Add " : ""}${p.name}, ${p.stockQuantity} ${p.unit}, ${currency.format(p.priceCents / 100)}${inCart ? `, ${cartQuantity} in cart` : ""}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 9,
        paddingHorizontal: 12,
        minHeight: 62,
        backgroundColor: pressed ? theme.inputBackground : inCart ? theme.successSoft : theme.cardBackground,
        borderTopLeftRadius: first ? RADIUS : 0,
        borderTopRightRadius: first ? RADIUS : 0,
        borderBottomLeftRadius: last ? RADIUS : 0,
        borderBottomRightRadius: last ? RADIUS : 0,
        // In-cart rows get a light green frame in place of the hairline separator.
        borderWidth: inCart ? 1 : 0,
        borderTopWidth: inCart ? 1 : first ? 0 : StyleSheet.hairlineWidth,
        borderColor: inCart ? `${theme.success}99` : theme.divider,
      })}
    >
      {uri && source !== "none" ? (
        <Image
          source={{ uri }}
          onError={() => setSource((s) => (s === "thumb" ? "main" : "none"))}
          style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: theme.inputBackground }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            backgroundColor: theme.inputBackground,
          }}
        >
          <Ionicons name="cube-outline" size={20} color={theme.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: "500" }}>
          {p.name}
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AppText
            numberOfLines={1}
            style={{
              color: out ? theme.danger : low ? theme.warning : theme.textSecondary,
              fontSize: 12,
              fontWeight: low ? "600" : "400",
              flexShrink: 1,
            }}
          >
            {out ? "Sold out" : `${p.stockQuantity} ${p.unit}`}
          </AppText>
          {inCart && (
            <View
              accessible={false}
              style={{
                minWidth: 20,
                height: 20,
                paddingHorizontal: 6,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.success,
              }}
            >
              <AppText
                style={{
                  // Light theme: white on the deep green; dark theme: black on the bright green.
                  color: theme.mode === "dark" ? "#000000" : "#ffffff",
                  fontSize: 11,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {cartQuantity}
              </AppText>
            </View>
          )}
          {!!p.categoryName && (
            <AppText numberOfLines={1} style={{ color: theme.placeholder, fontSize: 12, flexShrink: 1 }}>
              · {p.categoryName}
            </AppText>
          )}
        </View>
      </View>
      <AppText
        numberOfLines={1}
        style={{ color: theme.text, fontSize: 14, fontWeight: "600", maxWidth: "32%", textAlign: "right", fontVariant: ["tabular-nums"] }}
      >
        {currency.format(p.priceCents / 100)}
      </AppText>
      <Ionicons
        name={adding ? "add-circle" : "chevron-forward"}
        color={adding ? theme.primary : theme.placeholder}
        size={adding ? 24 : 16}
      />
    </Pressable>
  );
});
