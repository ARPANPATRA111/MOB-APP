import React, { useCallback, useLayoutEffect, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppScreen from "../src/components/ui/AppScreen";
import AppButton from "../src/components/ui/AppButton";
import {
  Busy,
  EmptyState,
  Group,
  ListRow,
  Notice,
  SearchField,
  useAction,
} from "../src/components/ui/CommerceUI";
import ProductRow from "../src/components/ProductRow";
import { AppText } from "../src/contexts/TypographyContext";
import { useTheme } from "../src/contexts/ThemeContext";
import {
  restoreProduct,
  type ProductPageOptions,
  type ProductRecord,
} from "../src/repositories/productRepository";
import { notifyDataChanged } from "../src/services/dataEvents";
import { useProductCatalog } from "../src/hooks/useProductCatalog";

type Stock = NonNullable<ProductPageOptions["stock"]>;
type Sort = NonNullable<ProductPageOptions["sort"]>;

const STOCK_LABEL: Record<string, string> = {
  all: "All",
  low: "Low stock",
  out: "Sold out",
  archived: "Archived",
};
const SORT_LABEL: Record<string, string> = {
  name: "Name",
  "stock-asc": "Lowest stock",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

/** Bottom sheet with the stock filter and sort order. */
function FilterSheet({
  visible,
  onClose,
  stock,
  sort,
  onStock,
  onSort,
}: {
  visible: boolean;
  onClose: () => void;
  stock: Stock;
  sort: Sort;
  onStock: (v: Stock) => void;
  onSort: (v: Sort) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Dismiss" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} />
      <View
        style={{
          backgroundColor: theme.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 10 }}>
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: theme.disabled }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <AppText style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>Filter & sort</AppText>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <AppText style={{ color: theme.primary, fontSize: 15, fontWeight: "600" }}>Done</AppText>
          </Pressable>
        </View>
        <Group title="Show">
          {(Object.keys(STOCK_LABEL) as Stock[]).map((v) => (
            <ListRow
              key={v}
              title={STOCK_LABEL[v]}
              onPress={() => onStock(v)}
              chevron={false}
              right={stock === v ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : undefined}
            />
          ))}
        </Group>
        <Group title="Sort by">
          {(Object.keys(SORT_LABEL) as Sort[]).map((v) => (
            <ListRow
              key={v}
              title={SORT_LABEL[v]}
              onPress={() => onSort(v)}
              chevron={false}
              right={sort === v ? <Ionicons name="checkmark" size={20} color={theme.primary} /> : undefined}
            />
          ))}
        </Group>
        <Group>
          <ListRow
            icon="download"
            iconColor="#5ac8fa"
            title="Import products from CSV"
            onPress={() => {
              onClose();
              navigation.navigate("Import");
            }}
          />
        </Group>
      </View>
    </Modal>
  );
}

export default function InventoryScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState<Stock>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [filters, setFilters] = useState(false);
  const catalog = useProductCatalog(query, stock, sort);
  const action = useAction();
  const filtered = stock !== "all" || sort !== "name";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter and sort products"
          onPress={() => setFilters(true)}
          hitSlop={8}
          style={{ padding: 8, flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Ionicons name="options-outline" size={24} color={theme.primary} />
          {filtered && (
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.primary }} />
          )}
        </Pressable>
      ),
    });
  }, [navigation, theme.primary, filtered]);

  const open = useCallback(
    (item: ProductRecord) =>
      stock === "archived"
        ? action.run(async () => {
            await restoreProduct(item.id);
            notifyDataChanged();
          })
        : navigation.navigate("AddItem", { productId: item.id }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stock, navigation],
  );
  const renderItem = useCallback(
    ({ item, index }: { item: ProductRecord; index: number }) => (
      <ProductRow
        product={item}
        first={index === 0}
        last={index === catalog.rows.length - 1}
        onPress={() => open(item)}
      />
    ),
    [open, catalog.rows.length],
  );

  return (
    <AppScreen theme={theme} scroll={false} contentStyle={{ paddingTop: 4 }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, category or price"
      />
      {filtered && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {stock !== "all" && (
            <Chip label={STOCK_LABEL[stock]} onClear={() => setStock("all")} />
          )}
          {sort !== "name" && (
            <Chip label={SORT_LABEL[sort]} onClear={() => setSort("name")} />
          )}
        </View>
      )}
      <Notice message={catalog.error || action.error} error onRetry={catalog.refresh} />
      <FlatList
        data={catalog.rows}
        keyExtractor={(p) => p.id}
        refreshing={catalog.loading && !catalog.rows.length}
        onRefresh={catalog.refresh}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        onEndReached={catalog.loadMore}
        onEndReachedThreshold={0.4}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 90 }}
        renderItem={renderItem}
        ListEmptyComponent={
          catalog.loading ? (
            <Busy />
          ) : query ? (
            <EmptyState icon="search" title="No matches" message="Try another name, category or a price like 45." />
          ) : stock !== "all" ? (
            <EmptyState icon="cube-outline" title={`No ${STOCK_LABEL[stock].toLowerCase()} products`} />
          ) : (
            <EmptyState
              icon="cube-outline"
              title="No products yet"
              message="Add your first product or import a CSV from the filter menu."
            />
          )
        }
        ListFooterComponent={catalog.loading && catalog.rows.length ? <Busy /> : null}
      />
      <View style={{ position: "absolute", right: 16, bottom: 12 }}>
        <AppButton
          theme={theme}
          icon="add"
          label="Add product"
          onPress={() => navigation.navigate("AddItem")}
          style={{
            borderRadius: 24,
            paddingHorizontal: 18,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          }}
        />
      </View>
      <FilterSheet
        visible={filters}
        onClose={() => setFilters(false)}
        stock={stock}
        sort={sort}
        onStock={setStock}
        onSort={setSort}
      />
    </AppScreen>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label} filter`}
      onPress={onClear}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingLeft: 10,
        paddingRight: 6,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.primarySoft,
      }}
    >
      <AppText style={{ color: theme.primary, fontSize: 12, fontWeight: "600" }}>{label}</AppText>
      <Ionicons name="close-circle" size={16} color={theme.primary} />
    </Pressable>
  );
}

