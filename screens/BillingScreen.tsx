import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Keyboard, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import AppScreen from "../src/components/ui/AppScreen";
import AppButton from "../src/components/ui/AppButton";
import ProductScanner from "../src/components/ProductScanner";
import { EmptyState, Notice, RADIUS, SearchField, useAction } from "../src/components/ui/CommerceUI";
import { AppText, useTypography } from "../src/contexts/TypographyContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useCurrency } from "../src/contexts/CurrencyContext";
import { useToast } from "../src/components/ui/ToastProvider";
import { useDialog } from "../src/components/ui/DialogProvider";
import {
  addProductToCart,
  calculateCartMoneyTotals,
  removeCartItem,
  updateCartQuantity,
  type CartItem,
} from "../src/domain/cart";
import { filterCartItems } from "../src/domain/cartSearch";
import { getProductByBarcode, toInventoryItem } from "../src/repositories/productRepository";
import { billingSession, useCheckoutDraft } from "../src/services/billingSession";
import { thumbUriFor } from "../src/services/productImages";
import { useKeyboardOpen } from "../src/hooks/useKeyboardOpen";

/** Full-size product photo, opened by long-pressing a cart thumbnail; a tap on the backdrop closes it. */
function ImagePreview({ uri, name, onClose }: { uri: string | null; name: string; onClose: () => void }) {
  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close photo"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.9)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* The photo itself swallows taps so only the dark backdrop dismisses. */}
        <Pressable onPress={() => {}} style={{ width: "100%" }}>
          {uri && (
            <Image
              source={{ uri }}
              resizeMode="contain"
              style={{ width: "100%", aspectRatio: 1, borderRadius: 18 }}
            />
          )}
        </Pressable>
        <AppText
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          {name}
        </AppText>
        <AppText style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>Tap outside to close</AppText>
      </Pressable>
    </Modal>
  );
}

/** Small tinted icon for the navigation bar. */
function HeaderIcon({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        padding: 8,
        opacity: disabled ? 0.3 : pressed ? 0.5 : 1,
      })}
    >
      <Ionicons name={name} size={23} color={theme.primary} />
    </Pressable>
  );
}

const STEP_HEIGHT = 30;

/**
 * Two-line cart row built to keep a 200-line bill scannable: photo at the
 * left, name and line total on the first line, unit price with the remove
 * button and quantity stepper on the second. Memoised so editing one line
 * leaves the rest untouched.
 */
const CartRow = memo(function CartRow({
  item,
  first,
  last,
  onError,
  onPreview,
  onFocus,
}: {
  item: CartItem;
  first: boolean;
  last: boolean;
  onError: (id: string, error: string) => void;
  onPreview: (uri: string, name: string) => void;
  onFocus: (id: string) => void;
}) {
  const { theme } = useTheme();
  const { scale } = useTypography();
  const currency = useCurrency();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [error, setError] = useState("");
  const [thumbBroken, setThumbBroken] = useState(false);
  useEffect(() => {
    setQuantity(String(item.quantity));
  }, [item.quantity]);
  const edit = (value: string) => {
    setQuantity(value);
    try {
      if (!value.trim() || !Number.isFinite(Number(value)) || Number(value) <= 0)
        throw new Error("Enter a quantity above zero.");
      billingSession.updateCart((cart) => updateCartQuantity([...cart], item.id, Number(value)));
      setError("");
      onError(item.id, "");
    } catch (e) {
      setError((e as Error).message);
      onError(item.id, (e as Error).message);
    }
  };
  const remove = () => {
    billingSession.updateCart((cart) => removeCartItem([...cart], item.id));
    onError(item.id, "");
  };
  const step = (delta: number) => {
    const next = Math.round((item.quantity + delta) * 1000) / 1000;
    if (next <= 0) remove();
    else edit(String(next));
  };
  const stepButton = (icon: "add" | "remove", label: string, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => step(delta)}
      style={({ pressed }) => ({
        width: 30,
        height: STEP_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={theme.primary} />
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: theme.cardBackground,
        borderTopLeftRadius: first ? RADIUS : 0,
        borderTopRightRadius: first ? RADIUS : 0,
        borderBottomLeftRadius: last ? RADIUS : 0,
        borderBottomRightRadius: last ? RADIUS : 0,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.divider,
      }}
    >
      {item.image ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={`Photo of ${item.name}, long press to enlarge`}
          onLongPress={() => onPreview(item.image!, item.name)}
          delayLongPress={250}
        >
          <Image
            source={{ uri: thumbBroken ? item.image : thumbUriFor(item.image) }}
            onError={() => setThumbBroken(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: theme.inputBackground,
            }}
          />
        </Pressable>
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.inputBackground,
          }}
        >
          <Ionicons name="cube-outline" size={18} color={theme.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AppText
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.text,
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {item.name}
          </AppText>
          <AppText
            style={{
              color: theme.text,
              fontSize: 14,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
            }}
          >
            {currency.format(item.total)}
          </AppText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <AppText numberOfLines={1} style={{ flex: 1, color: theme.textSecondary, fontSize: 12 }}>
            {/* "each" keeps the unit price short on narrow phones; weights and volumes name the unit. */}
            {currency.format(item.price)} {!item.unit || item.unit === "piece" ? "each" : `/ ${item.unit}`}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name}`}
            onPress={remove}
            hitSlop={6}
            style={({ pressed }) => ({
              width: STEP_HEIGHT,
              height: STEP_HEIGHT,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 4,
              backgroundColor: pressed ? theme.dangerSoft : "transparent",
            })}
          >
            <Ionicons name="trash-outline" size={17} color={theme.danger} />
          </Pressable>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: theme.inputBackground,
              borderRadius: 9,
              overflow: "hidden",
            }}
          >
            {stepButton("remove", `Decrease ${item.name}`, -1)}
            <TextInput
              accessibilityLabel={`Quantity for ${item.name}`}
              keyboardType="decimal-pad"
              value={quantity}
              onChangeText={edit}
              onFocus={() => onFocus(item.id)}
              selectTextOnFocus
              maxLength={8}
              maxFontSizeMultiplier={1.2}
              cursorColor={theme.primary}
              style={{
                width: 46,
                height: STEP_HEIGHT - 4,
                textAlign: "center",
                fontFamily: "Inter_600SemiBold",
                fontSize: 14 * scale,
                color: theme.text,
                backgroundColor: theme.cardBackground,
                borderRadius: 7,
                paddingVertical: 0,
              }}
            />
            {stepButton("add", `Increase ${item.name}`, 1)}
          </View>
        </View>
        {!!error && <AppText style={{ color: theme.danger, fontSize: 11 }}>{error}</AppText>}
      </View>
    </View>
  );
});

export default function BillingScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const draft = useCheckoutDraft();
  const action = useAction();
  const { showToast } = useToast();
  const { confirm } = useDialog();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ uri: string; name: string } | null>(null);
  const [query, setQuery] = useState("");
  const list = useRef<FlatList<CartItem>>(null);
  const focused = useRef<string | null>(null);
  // While typing (search or a quantity) the action bar steps aside so the lines stay visible.
  const keyboardOpen = useKeyboardOpen();

  let total = 0;
  let error = "";
  try {
    if (draft.cart.length) total = calculateCartMoneyTotals(draft.cart).subtotal;
  } catch (e) {
    error = (e as Error).message;
  }
  const invalid = draft.cart.some((c) => errors[c.id]);
  const count = draft.cart.reduce((n, c) => n + c.quantity, 0);
  const summary = `${draft.cart.length} ${draft.cart.length === 1 ? "item" : "items"} · ${currency.format(total)}`;

  // The line just scanned is the one the cashier wants to check, so it sits on top.
  const visible = useMemo(() => filterCartItems([...draft.cart].reverse(), query), [draft.cart, query]);

  const clear = () =>
    action.run(async () => {
      if (
        await confirm({
          title: "Clear this bill?",
          message: "All items will be removed from the cart.",
          confirmText: "Clear",
          destructive: true,
        })
      ) {
        billingSession.setCart([]);
        setErrors({});
        setQuery("");
      }
    });
  const clearRef = useRef(clear);
  clearRef.current = clear;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <HeaderIcon name="albums-outline" label="Parked bills" onPress={() => navigation.navigate("ParkedBills")} />
          <HeaderIcon
            name="trash-outline"
            label="Clear cart"
            disabled={!draft.cart.length}
            onPress={() => clearRef.current()}
          />
        </View>
      ),
    });
  }, [navigation, draft.cart.length]);

  const park = () =>
    action.run(async () => {
      await billingSession.park();
      setQuery("");
      showToast({ message: "Bill parked", variant: "success" });
      navigation.navigate("ParkedBills");
    });

  /** Adds one unit and reports what was added so the scanner can show it. */
  const scan = async (code: string) => {
    const product = await getProductByBarcode(code);
    if (!product) throw new Error(`No product with barcode ${code}. Add it in Stock first.`);
    const cart = addProductToCart(billingSession.getCart(), toInventoryItem(product));
    billingSession.setCart(cart);
    const line = cart.find((c) => c.id === product.barcode);
    const items = cart.length;
    return {
      title: `${product.name} · +1`,
      subtitle: `${line ? `${line.quantity} in cart · ` : ""}${items} ${items === 1 ? "item" : "items"} · ${currency.format(
        calculateCartMoneyTotals(cart).subtotal,
      )}`,
    };
  };

  // Once the keyboard is up, bring the row being edited into the visible half of the list.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      const index = visible.findIndex((c) => c.id === focused.current);
      if (index >= 0)
        list.current?.scrollToIndex({
          index,
          viewPosition: 0.4,
          animated: true,
        });
    });
    return () => sub.remove();
  }, [visible]);

  const onError = useCallback(
    (id: string, message: string) => setErrors((current) => ({ ...current, [id]: message })),
    [],
  );
  const onPreview = useCallback((uri: string, name: string) => setPreview({ uri, name }), []);
  const onFocus = useCallback((id: string) => {
    focused.current = id;
  }, []);

  return (
    <AppScreen
      theme={theme}
      scroll={false}
      contentStyle={{ paddingTop: 10 }}
      footer={
        // Everything a cashier needs sits at the bottom, within thumb reach.
        !keyboardOpen && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 10,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1.6 }}>
                <ProductScanner
                  mode="continuous"
                  label="Scan products"
                  variant="primary"
                  summary={summary}
                  onScan={scan}
                  style={{ minHeight: 50 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton
                  theme={theme}
                  variant="secondary"
                  icon="search"
                  label="Find"
                  onPress={() => navigation.navigate("ProductPicker")}
                  style={{ minHeight: 50 }}
                />
              </View>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View>
                <AppText style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {draft.cart.length} {draft.cart.length === 1 ? "item" : "items"} · {count} qty
                </AppText>
                <AppText
                  style={{
                    color: theme.text,
                    fontSize: 22,
                    fontWeight: "700",
                    letterSpacing: -0.5,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {currency.format(total)}
                </AppText>
              </View>
              <AppButton
                theme={theme}
                icon="arrow-forward"
                label="Take payment"
                disabled={!draft.cart.length || invalid || !!error || action.busy}
                onPress={() => navigation.navigate("BillReview")}
                style={{ paddingHorizontal: 22 }}
              />
            </View>
          </View>
        )
      }
    >
      {draft.cart.length > 0 && (
        <SearchField value={query} onChangeText={setQuery} placeholder="Search this bill by name or price" />
      )}
      <Notice message={action.error || error || billingSession.getError()} error />
      {draft.cart.length ? (
        <FlatList
          ref={list}
          data={visible}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={9}
          onScrollToIndexFailed={() => {}}
          style={{ marginHorizontal: -16 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 24,
          }}
          ListHeaderComponent={
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
                paddingLeft: 14,
                paddingRight: 2,
              }}
            >
              <AppText
                style={{
                  color: theme.textSecondary,
                  fontSize: 12,
                  fontWeight: "500",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                {query ? `${visible.length} of ${draft.cart.length} lines` : `Cart · ${draft.cart.length}`}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Park this bill and continue later"
                onPress={park}
                disabled={action.busy}
                hitSlop={6}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  height: 26,
                  paddingLeft: 8,
                  paddingRight: 10,
                  borderRadius: 13,
                  backgroundColor: theme.primarySoft,
                  opacity: pressed || action.busy ? 0.6 : 1,
                })}
              >
                <Ionicons name="pause" size={13} color={theme.primary} />
                <AppText
                  style={{
                    color: theme.primary,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  Park
                </AppText>
              </Pressable>
            </View>
          }
          renderItem={({ item, index }) => (
            <CartRow
              item={item}
              first={index === 0}
              last={index === visible.length - 1}
              onError={onError}
              onPreview={onPreview}
              onFocus={onFocus}
            />
          )}
          ListEmptyComponent={
            <EmptyState icon="search" title="No lines match" message="Try another name or the item's price." />
          }
        />
      ) : (
        <EmptyState
          icon="cart-outline"
          title="Cart is empty"
          message="Tap Scan products and hold each barcode under the camera. Use Find for items without a barcode."
        />
      )}
      <ImagePreview uri={preview?.uri ?? null} name={preview?.name ?? ""} onClose={() => setPreview(null)} />
    </AppScreen>
  );
}
