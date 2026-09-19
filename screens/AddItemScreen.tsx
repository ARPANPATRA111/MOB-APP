import Ionicons from "@expo/vector-icons/Ionicons";
import SelectField from "../src/components/ui/SelectField";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation, useRoute } from "@react-navigation/native";
import AppScreen, { type AppScreenHandle } from "../src/components/ui/AppScreen";
import AppButton from "../src/components/ui/AppButton";
import {
  Busy,
  FormRow,
  Group,
  ListRow,
  Notice,
  useAction,
} from "../src/components/ui/CommerceUI";
import ProductScanner from "../src/components/ProductScanner";
import { AppText } from "../src/contexts/TypographyContext";
import { useTheme } from "../src/contexts/ThemeContext";
import { useCurrency } from "../src/contexts/CurrencyContext";
import { toCents } from "../src/domain/money";
import { PRODUCT_UNITS } from "../src/domain/commerce";
import { generateInStoreBarcode } from "../src/domain/barcode";
import {
  createProduct,
  getProductByBarcode,
  getProductById,
  softDeleteProduct,
  updateProduct,
  type ProductRecord,
} from "../src/repositories/productRepository";
import { removeProductPhoto, storeProductPhoto } from "../src/services/productImages";
import { notifyDataChanged } from "../src/services/dataEvents";
import { useDialog } from "../src/components/ui/DialogProvider";
import { useToast } from "../src/components/ui/ToastProvider";

type Field = "name" | "price" | "quantity" | "barcode";

/** Only these are mandatory; the barcode is generated when blank and the photo is optional. */
const REQUIRED: Field[] = ["name", "price", "quantity"];
const FIELD_LABEL: Record<Field, string> = { name: "Name", price: "Price", quantity: "In stock", barcode: "Code" };
/** How long the red status line under the form stays up. */
const STATUS_MS = 3000;
/** After this long without a reply the status line says the database is busy. */
const SLOW_SAVE_MS = 6000;

/** Validation problem tied to one form row, so the row can be highlighted. */
class FieldError extends Error {
  constructor(
    readonly field: Field | null,
    message: string,
  ) {
    super(message);
  }
}

/** Picks the row an error message is about, for messages raised inside the repository. */
const fieldFor = (message: string): Field | null =>
  /price|money|amount/i.test(message)
    ? "price"
    : /quantit|stock/i.test(message)
      ? "quantity"
      : /barcode|code/i.test(message)
        ? "barcode"
        : /name/i.test(message)
          ? "name"
          : null;

export default function AddItemScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const productId = route.params?.productId as string | undefined;

  const [details, setDetails] = useState(false);
  const [original, setOriginal] = useState<ProductRecord | null>(null);
  const [loading, setLoading] = useState(!!productId);
  const [loadError, setLoadError] = useState("");
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [existing, setExisting] = useState<ProductRecord | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const screen = useRef<AppScreenHandle>(null);
  const newPhotos = useRef<string[]>([]);
  const mounted = useRef(true);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    barcode: "",
    name: "",
    quantity: "0",
    price: "",
    category: "",
    unit: "piece",
    cost: "",
    threshold: "",
    imageUri: null as string | null,
  });

  const { busy, error, run, setError } = useAction();
  const { confirm } = useDialog();
  const { showToast } = useToast();

  const change = (key: keyof typeof form, value: string | null) => {
    setForm((f) => ({ ...f, [key]: value }));
    setInvalid((list) => list.filter((k) => k !== key));
  };

  /**
   * One red line directly above Save, shown for three seconds. It sits in the
   * sticky footer so it is visible with the keyboard up, unlike the notice at
   * the top of the form, and it always names the reason in plain words.
   */
  const flash = useCallback((message: string) => {
    if (!mounted.current) return;
    setStatus(message);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => mounted.current && setStatus(null), STATUS_MS);
  }, []);

  useEffect(() => {
    let active = true;
    if (productId)
      getProductById(productId)
        .then((p) => {
          if (!active) return;
          if (!p) throw new Error("Product unavailable");
          setOriginal(p);
          setForm({
            barcode: p.barcode,
            name: p.name,
            quantity: String(p.stockQuantity),
            price: String(p.priceCents / 100),
            category: p.categoryName ?? "",
            unit: p.unit,
            cost: p.costCents == null ? "" : String(p.costCents / 100),
            threshold: String(p.lowStockThreshold),
            imageUri: p.imageUri ?? null,
          });
          if (p.costCents != null) setDetails(true);
        })
        .catch((e) => {
          if (active) setLoadError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [productId]);

  // Photos taken in this session but never saved are removed when leaving.
  useEffect(
    () => () => {
      mounted.current = false;
      if (statusTimer.current) clearTimeout(statusTimer.current);
      for (const uri of newPhotos.current) void removeProductPhoto(uri);
    },
    [],
  );

  /** A barcode that is already in stock opens that product instead of failing on save. */
  const checkExisting = useCallback(
    async (code: string, viaScanner: boolean) => {
      const trimmed = code.trim();
      if (!trimmed) {
        setExisting(null);
        return;
      }
      const found = await getProductByBarcode(trimmed).catch(() => null);
      if (found && found.id !== productId) {
        if (viaScanner && !productId) {
          showToast({
            message: `${found.name} is already in stock`,
            detail: "Opening it for editing.",
            variant: "info",
          });
          navigation.replace("AddItem", { productId: found.id });
          return;
        }
        setExisting(found);
      } else setExisting(null);
    },
    [navigation, productId, showToast],
  );

  // Typed or pasted codes are checked shortly after typing stops.
  useEffect(() => {
    const code = form.barcode.trim();
    if (code.length < 6) {
      setExisting(null);
      return;
    }
    const timer = setTimeout(() => void checkExisting(code, false), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.barcode]);

  /** Photo processing has its own busy state so it can never swallow a Save tap. */
  const photo = async (camera = false) => {
    if (photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
        throw new Error("Camera access is needed to take a product photo.");
      const result = await (camera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync)({
        mediaTypes: ["images"],
        // The platform crop screen is unreliable on several Android OEMs; we resize ourselves.
        allowsEditing: false,
        quality: 0.6,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const uri = await storeProductPhoto(asset.uri, asset.width, asset.height);
      // The user may have saved and left while the camera was open.
      if (!mounted.current) {
        void removeProductPhoto(uri);
        return;
      }
      newPhotos.current.push(uri);
      change("imageUri", uri);
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        flash((e as Error).message);
      }
    } finally {
      if (mounted.current) setPhotoBusy(false);
    }
  };

  const missing = REQUIRED.filter((key) => !form[key].trim());
  const canSave = missing.length === 0 && !photoBusy;

  /** A tap on the light-blue (disabled) Save says what is still needed. */
  const explain = () => {
    if (photoBusy) {
      flash("Photo is still being prepared. Save unlocks in a moment.");
      return;
    }
    setInvalid(missing);
    screen.current?.scrollToTop();
    const names = missing.map((k) => FIELD_LABEL[k]).join(", ");
    flash(`Fill ${names} to save this product.`);
    showToast({ message: "Fill the highlighted fields", detail: names, variant: "error" });
  };

  /** Turns the text fields into a repository input, naming the first bad row. */
  const readForm = () => {
    const money = (text: string, field: Field | null, label: string) => {
      try {
        return toCents(text) / 100;
      } catch {
        throw new FieldError(field, `${label} "${text.trim()}" is not a number. Use digits, e.g. 45 or 45.50.`);
      }
    };
    const count = (text: string, field: Field | null, label: string) => {
      const value = Number(text);
      if (!text.trim() || !Number.isFinite(value))
        throw new FieldError(field, `${label} "${text.trim()}" is not a number.`);
      return value;
    };
    return {
      barcode: form.barcode.trim() || generateInStoreBarcode(),
      name: form.name,
      quantity: count(form.quantity, "quantity", "In stock"),
      price: money(form.price, "price", "Price"),
      category: form.category,
      unit: form.unit,
      costPrice: form.cost.trim() ? money(form.cost, null, "Buying cost") : null,
      lowStockThreshold: form.threshold.trim() ? count(form.threshold, null, "Alert below") : 5,
      imageUri: form.imageUri,
      stockReason: "Inventory count corrected in product editor",
      expectedVersion: original?.version,
    };
  };

  const save = () => {
    if (!canSave) {
      explain();
      return;
    }
    void run(async () => {
      // If SQLite is held by something else (a backup, a big import) say so instead of spinning silently.
      const slow = setTimeout(() => flash("Still saving… the database is busy. Give it a moment."), SLOW_SAVE_MS);
      try {
        const input = readForm();
        if (productId) await updateProduct(productId, input);
        else await createProduct(input);
      } catch (e) {
        const message = (e as Error).message;
        const field = e instanceof FieldError ? e.field : fieldFor(message);
        if (field) setInvalid([field]);
        screen.current?.scrollToTop();
        flash(message);
        showToast({ message: "Could not save", detail: message, variant: "error", duration: 3500 });
        throw e;
      } finally {
        clearTimeout(slow);
      }
      // Saved photos now belong to the product; a replaced photo is removed.
      newPhotos.current = newPhotos.current.filter((u) => u !== form.imageUri);
      if (original?.imageUri && original.imageUri !== form.imageUri) void removeProductPhoto(original.imageUri);
      notifyDataChanged();
      showToast({ message: productId ? "Product updated" : "Product added", variant: "success" });
      navigation.goBack();
    });
  };

  const symbol = currency.symbol.trim();
  const has = (key: Field) => invalid.includes(key);
  const unitLabel = <AppText style={{ color: theme.textSecondary, fontSize: 14 }}>{form.unit}</AppText>;
  const symbolLabel = <AppText style={{ color: theme.textSecondary, fontSize: 14 }}>{symbol}</AppText>;

  return (
    <AppScreen
      ref={screen}
      theme={theme}
      keyboardAware
      footer={
        !loading &&
        !loadError && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
            {status && (
              <View
                accessibilityLiveRegion="polite"
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 }}
              >
                <Ionicons name="alert-circle" size={15} color={theme.danger} />
                <AppText numberOfLines={2} style={{ flex: 1, color: theme.danger, fontSize: 12, fontWeight: "500" }}>
                  {status}
                </AppText>
              </View>
            )}
            <AppButton
              theme={theme}
              label="Save product"
              onPress={save}
              loading={busy}
              disabled={!canSave}
              onDisabledPress={explain}
            />
          </View>
        )
      }
    >
      {loading ? (
        <Busy />
      ) : loadError ? (
        <Notice message={loadError} error />
      ) : (
        <>
          <Notice message={error} error />
          <View style={{ alignItems: "center", marginBottom: 14, gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={form.imageUri ? "Change product photo" : "Add product photo (optional)"}
              onPress={() => photo(true)}
              disabled={photoBusy}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              {form.imageUri ? (
                <Image
                  source={{ uri: form.imageUri }}
                  style={{ width: 96, height: 96, borderRadius: 22, backgroundColor: theme.inputBackground }}
                  accessibilityLabel="Product photo"
                />
              ) : (
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: theme.cardBackground,
                    borderWidth: 1,
                    borderColor: theme.divider,
                    borderStyle: "dashed",
                  }}
                >
                  {photoBusy ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Ionicons name="camera" size={28} color={theme.primary} />
                  )}
                </View>
              )}
            </Pressable>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Pressable accessibilityRole="button" onPress={() => photo(true)} disabled={photoBusy} hitSlop={6}>
                <AppText style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>
                  {form.imageUri ? "Retake" : "Take photo"}
                </AppText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => photo()} disabled={photoBusy} hitSlop={6}>
                <AppText style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>Gallery</AppText>
              </Pressable>
              {form.imageUri && (
                <Pressable accessibilityRole="button" onPress={() => change("imageUri", null)} hitSlop={6}>
                  <AppText style={{ color: theme.danger, fontSize: 13, fontWeight: "600" }}>Remove</AppText>
                </Pressable>
              )}
            </View>
            <AppText style={{ color: photoBusy ? theme.primary : theme.placeholder, fontSize: 11 }}>
              {photoBusy ? "Processing photo… you can keep filling the form" : "Photo is optional"}
            </AppText>
          </View>
          <Group title="Product" footer={invalid.length ? "Fields marked * are required." : undefined}>
            <FormRow
              label="Name"
              required
              invalid={has("name")}
              value={form.name}
              onChangeText={(v) => change("name", v)}
              placeholder="Basmati rice"
              autoCapitalize="sentences"
              returnKeyType="next"
            />
            <FormRow
              label="Price"
              required
              invalid={has("price")}
              value={form.price}
              onChangeText={(v) => change("price", v.replace(",", "."))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              trailing={symbolLabel}
            />
            <FormRow
              label="In stock"
              required
              invalid={has("quantity")}
              value={form.quantity}
              onChangeText={(v) => change("quantity", v.replace(",", "."))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              trailing={unitLabel}
            />
            <SelectField
              label="Sold by"
              value={form.unit}
              options={PRODUCT_UNITS.map((v) => ({ value: v, label: v === "piece" ? "Piece" : v }))}
              onChange={(v) => change("unit", v)}
            />
            <FormRow
              label="Category"
              value={form.category}
              onChangeText={(v) => change("category", v)}
              placeholder="Optional"
              autoCapitalize="words"
            />
          </Group>
          <Group
            title="Barcode"
            footer={
              existing
                ? undefined
                : "Optional. Leave blank and an in-store EAN-13 (starting 20) is generated for a sticker."
            }
          >
            <FormRow
              label="Code"
              invalid={has("barcode")}
              value={form.barcode}
              onChangeText={(v) => change("barcode", v)}
              autoCapitalize="none"
              maxLength={128}
              placeholder="Optional"
              trailing={
                <ProductScanner
                  compact
                  label="Scan"
                  onScan={async (code) => {
                    change("barcode", code);
                    await checkExisting(code, true);
                  }}
                />
              }
            />
            {existing && (
              <ListRow
                icon="alert-circle"
                iconColor="#ff9500"
                title={`Already in stock: ${existing.name}`}
                subtitle="Tap to edit that product instead"
                onPress={() => navigation.replace("AddItem", { productId: existing.id })}
              />
            )}
          </Group>
          <Group
            title="More"
            footer={
              details
                ? "Buying cost is what you pay per unit; it is only used for profit reports. Low-stock alert defaults to 5."
                : undefined
            }
          >
            <ListRow
              title="Buying cost & low-stock alert"
              subtitle="Optional"
              onPress={() => setDetails(!details)}
              chevron={false}
              right={<Ionicons name={details ? "chevron-up" : "chevron-down"} size={18} color={theme.placeholder} />}
            />
            {details && (
              <FormRow
                label="Buying cost"
                value={form.cost}
                onChangeText={(v) => change("cost", v.replace(",", "."))}
                keyboardType="decimal-pad"
                placeholder="Optional"
                trailing={symbolLabel}
              />
            )}
            {details && (
              <FormRow
                label="Alert below"
                value={form.threshold}
                onChangeText={(v) => change("threshold", v.replace(",", "."))}
                keyboardType="decimal-pad"
                placeholder="5"
                trailing={unitLabel}
              />
            )}
          </Group>
          {productId && (
            <Group>
              <ListRow
                title="Archive product"
                destructive
                chevron={false}
                onPress={() =>
                  run(async () => {
                    if (
                      await confirm({
                        title: "Archive product?",
                        message:
                          "It leaves the active catalog. Stock and history stay, and you can restore it from the Archived filter.",
                        confirmText: "Archive",
                        destructive: true,
                      })
                    ) {
                      await softDeleteProduct(productId);
                      notifyDataChanged();
                      navigation.goBack();
                    }
                  })
                }
              />
            </Group>
          )}
        </>
      )}
    </AppScreen>
  );
}
