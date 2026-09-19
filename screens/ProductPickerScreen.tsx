import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AppScreen from "../src/components/ui/AppScreen";
import ProductRow from "../src/components/ProductRow";
import {
  Busy,
  EmptyState,
  Notice,
  SearchField,
  useAction,
} from "../src/components/ui/CommerceUI";
import { AppText } from "../src/contexts/TypographyContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useToast } from "../src/components/ui/ToastProvider";
import { useProductCatalog } from "../src/hooks/useProductCatalog";
import {
  getProductById,
  toInventoryItem,
  type ProductRecord,
} from "../src/repositories/productRepository";
import { addProductToCart } from "../src/domain/cart";
import { billingSession, useCheckoutDraft } from "../src/services/billingSession";

/**
 * Full-screen product search for items without a barcode. Tapping a row adds
 * one unit and keeps the sheet open so several items can be picked in a row;
 * Done returns to the cart.
 */
export default function ProductPickerScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { showToast } = useToast();
  const draft = useCheckoutDraft();
  const [query, setQuery] = useState("");
  const catalog = useProductCatalog(query, "in");
  const action = useAction();
  const count = draft.cart.length;
  // Cart lines are keyed by barcode, which is what the picker rows carry too.
  const inCart = useMemo(() => {
    const map: Record<string, number> = Object.create(null);
    for (const line of draft.cart) map[line.id] = line.quantity;
    return map;
  }, [draft.cart]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: count ? `Add to cart · ${count}` : "Add to cart",
      headerRight: () => (
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} hitSlop={8} style={{ padding: 8 }}>
          <AppText style={{ color: theme.primary, fontSize: 15, fontWeight: "600" }}>Done</AppText>
        </Pressable>
      ),
    });
  }, [navigation, theme.primary, count]);

  const add = useCallback(
    (item: ProductRecord) =>
      action.run(async () => {
        const fresh = await getProductById(item.id);
        if (!fresh) throw new Error("This product is no longer available.");
        billingSession.setCart(addProductToCart(billingSession.getCart(), toInventoryItem(fresh)));
        showToast({ message: `Added ${fresh.name}`, variant: "success", duration: 1200 });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showToast],
  );

  return (
    <AppScreen theme={theme} scroll={false} contentStyle={{ paddingTop: 10 }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, category or price"
        autoFocus
      />
      <Notice message={action.error || catalog.error} error />
      <FlatList
        data={catalog.rows}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30 }}
        onEndReached={catalog.loadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item, index }) => (
          <ProductRow
            product={item}
            adding
            first={index === 0}
            last={index === catalog.rows.length - 1}
            cartQuantity={inCart[item.barcode] ?? 0}
            onPress={() => add(item)}
          />
        )}
        ListEmptyComponent={
          catalog.loading ? (
            <Busy />
          ) : (
            <EmptyState
              icon="search"
              title={query ? "No stocked products match" : "No products in stock"}
              message={query ? "Try a different name, category or price." : undefined}
            />
          )
        }
        ListFooterComponent={
          <View>{catalog.loading && catalog.rows.length ? <Busy /> : null}</View>
        }
      />
    </AppScreen>
  );
}
