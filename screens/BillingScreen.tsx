import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Camera, CameraView, BarcodeScanningResult } from 'expo-camera';
import { Audio } from 'expo-av';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../App';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { useDialog } from '../src/components/ui/DialogProvider';
import { removeCartItem, updateCartQuantity, type CartItem } from '../src/domain/cart';
import {
  addScannedProductToCart,
  buildProductNotFoundMessage,
  validateCartForCheckout,
} from '../src/domain/scannerCart';
import { storageService } from '../src/services/storage';
import { billingSession } from '../src/services/billingSession';
import { canonicalBarcode } from '../src/domain/barcode';
import type { InventoryItem } from '../src/types';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import AppBadge from '../src/components/ui/AppBadge';
import AppButton from '../src/components/ui/AppButton';
import AppCard from '../src/components/ui/AppCard';
import AppEmptyState from '../src/components/ui/AppEmptyState';
import AppLoadingState from '../src/components/ui/AppLoadingState';
import AppScreen from '../src/components/ui/AppScreen';
import BottomActionBar from '../src/components/ui/BottomActionBar';
import SearchBar from '../src/components/ui/SearchBar';
import SectionHeader from '../src/components/ui/SectionHeader';
import BarcodeInputModal from '../src/components/BarcodeInputModal';
import { typography } from '../src/theme/typography';

const SCAN_REPEAT_GUARD_MS = 700;

const BillingScreen: React.FC<{ navigation: StackNavigationProp<RootStackParamList, 'Billing'> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const currency = useCurrency();
  const dialog = useDialog();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastScanRef = useRef<{ barcode: string; at: number } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => billingSession.getCart());
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 220);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const debouncedPicker = useDebouncedValue(pickerQuery, 220);
  const [pickerProducts, setPickerProducts] = useState<InventoryItem[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  const scannerActive = hasPermission === true && isFocused && !showManualInput && !showPicker;

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);

  const showToast = useCallback((tone: 'success' | 'warning' | 'danger', text: string) => {
    setToast({ tone, text });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const loadProducts = useCallback(
    async (query = '') => {
      setSearching(true);
      try {
        const items = await storageService.searchInventory(query, 40);
        setProducts(items.filter((item) => item.quantity > 0));
      } catch (error) {
        console.error('Product search failed:', error);
        showToast('danger', 'Product search failed. Try again.');
      } finally {
        setSearching(false);
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    const setup = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
        const { sound } = await Audio.Sound.createAsync(require('../assets/BEEP_SOUND.mp3'));
        soundRef.current = sound;
        await loadProducts();
      } catch (error) {
        console.error('Billing setup failed:', error);
        void dialog.alert({ title: 'Billing unavailable', message: 'Unable to initialize billing right now.' });
        setLoading(false);
      }
    };
    void setup();
    return () => {
      void soundRef.current?.unloadAsync();
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [loadProducts, dialog]);

  useEffect(() => {
    void loadProducts(debouncedSearch);
  }, [debouncedSearch, loadProducts]);

  useEffect(() => {
    billingSession.setCart(cart);
  }, [cart]);

  // Load products for the browse-inventory picker.
  useEffect(() => {
    if (!showPicker) return;
    let active = true;
    void (async () => {
      try {
        const items = await storageService.searchInventory(debouncedPicker, 60);
        if (active) {
          setPickerProducts(items.filter((item) => item.quantity > 0));
        }
      } catch (error) {
        console.error('Picker search failed:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [showPicker, debouncedPicker]);

  const playSound = async () => {
    try {
      await soundRef.current?.replayAsync();
    } catch (error) {
      console.error('Beep failed:', error);
    }
  };

  const addProduct = useCallback(
    (product: InventoryItem, source: 'scan' | 'tap' | 'manual' = 'tap') => {
      try {
        setCart((items) => {
          const result = addScannedProductToCart(items, {
            barcode: product.barcode,
            name: product.name,
            price: product.price,
            quantity: product.quantity,
            imageUri: product.imageUri,
          });
          showToast(result.tone, source === 'tap' ? result.feedback.replace('Added:', 'Added from search:') : result.feedback);
          return result.cart;
        });
      } catch (error) {
        showToast('danger', (error as Error).message);
      }
    },
    [showToast]
  );

  const addBarcode = useCallback(
    async (barcode: string, source: 'scan' | 'manual') => {
      try {
        const normalized = barcode.trim();
        // Try the scanned value, then its canonical (UPC-A ↔ EAN-13) forms so a
        // product stored under either representation still matches.
        let product = await storageService.getInventoryItemByBarcode(normalized);
        if (!product) {
          const canon = canonicalBarcode(normalized);
          if (canon && canon !== normalized) {
            product = await storageService.getInventoryItemByBarcode(canon);
          }
        }
        if (!product && normalized.length === 13 && normalized.startsWith('0')) {
          product = await storageService.getInventoryItemByBarcode(normalized.slice(1));
        }
        if (!product) {
          showToast('warning', buildProductNotFoundMessage(normalized));
          return;
        }
        addProduct(product, source);
      } catch (error) {
        console.error('Barcode lookup failed:', error);
        showToast('danger', 'Could not look up that barcode. Try again.');
      }
    },
    [addProduct, showToast]
  );

  const scanBarcode = async (result: BarcodeScanningResult) => {
    try {
      const now = Date.now();
      if (lastScanRef.current?.barcode === result.data && now - lastScanRef.current.at < SCAN_REPEAT_GUARD_MS) {
        return;
      }
      lastScanRef.current = { barcode: result.data, at: now };
      await playSound();
      await addBarcode(result.data, 'scan');
    } catch (error) {
      console.error('Scan handling failed:', error);
      showToast('danger', 'Scan failed. Try again.');
    }
  };

  const changeQuantity = (item: CartItem, quantity: number) => {
    try {
      setCart((items) => updateCartQuantity(items, item.id, quantity, item.availableStock));
    } catch (error) {
      showToast('warning', (error as Error).message);
    }
  };

  const setQuantityDirect = (item: CartItem, text: string) => {
    const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (isNaN(parsed) || parsed <= 0) {
      return;
    }
    const clamped = Math.min(parsed, item.availableStock);
    changeQuantity(item, clamped);
    if (parsed > item.availableStock) {
      showToast('warning', `Only ${item.availableStock} in stock`);
    }
  };

  const reviewBill = () => {
    try {
      validateCartForCheckout(cart);
      billingSession.setCart(cart);
      navigation.navigate('BillReview');
    } catch (error) {
      showToast('warning', (error as Error).message);
    }
  };

  if (loading) {
    return <AppLoadingState theme={theme} label="Opening scanner..." />;
  }

  return (
    <AppScreen
      theme={theme}
      scroll={false}
      footer={(
        <BottomActionBar theme={theme}>
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerLabel}>{cart.length} items</Text>
              <Text style={styles.footerTotal}>{currency.format(cartTotal)}</Text>
            </View>
            <AppButton label="Review Bill" theme={theme} onPress={reviewBill} disabled={cart.length === 0} style={styles.reviewButton} />
          </View>
        </BottomActionBar>
      )}
    >
      <View style={styles.root}>
        <View style={styles.scannerArea}>
          {hasPermission ? (
            <CameraView
              style={styles.camera}
              facing="back"
              active={scannerActive}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={scannerActive ? scanBarcode : undefined}
            />
          ) : (
            <View style={styles.permissionBox}>
              <Ionicons name="camera-outline" size={24} color={theme.textSecondary} />
              <Text style={styles.permissionText}>Camera unavailable. Use manual barcode or browse.</Text>
            </View>
          )}
          {toast ? (
            <View style={[styles.toast, toastToneStyle(theme, toast.tone)]}>
              <Text style={[styles.toastText, { color: toastToneText(theme, toast.tone) }]}>{toast.text}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionChip} onPress={() => setShowPicker(true)}>
            <Ionicons name="list" size={16} color={theme.primary} />
            <Text style={styles.actionChipText}>Browse products</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionChip} onPress={() => setShowManualInput(true)}>
            <FontAwesome5 name="keyboard" size={14} color={theme.primary} />
            <Text style={styles.actionChipText}>Manual barcode</Text>
          </TouchableOpacity>
        </View>

        <SearchBar theme={theme} placeholder="Quick search product or barcode" value={searchQuery} onChangeText={setSearchQuery} />

        {debouncedSearch ? (
          <AppCard theme={theme} style={styles.searchPanel}>
            <SectionHeader theme={theme} title="Search results" subtitle={searching ? 'Searching...' : `${products.length} found`} />
            <FlatList
              data={products}
              keyExtractor={(item) => item.barcode}
              keyboardShouldPersistTaps="handled"
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResult} onPress={() => addProduct(item, 'tap')}>
                  <Text style={styles.searchName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.searchMeta}>Stock {item.quantity}</Text>
                  <Text style={styles.searchPrice}>{currency.format(item.price)}</Text>
                </TouchableOpacity>
              )}
            />
          </AppCard>
        ) : null}

        <AppCard theme={theme} style={styles.cartPanel}>
          <SectionHeader theme={theme} title="Live cart" subtitle="Scanned products appear here" right={<AppBadge theme={theme} label={`${cart.length}`} />} />
          {cart.length === 0 ? (
            <AppEmptyState theme={theme} title="No products scanned" message="Scan, search, browse, or enter a barcode to start." />
          ) : (
            <FlatList
              data={cart}
              keyExtractor={(item) => item.id}
              initialNumToRender={10}
              maxToRenderPerBatch={12}
              windowSize={7}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.cartRow}>
                  <View style={styles.cartInfo}>
                    <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cartMeta}>{currency.format(item.price)} · line {currency.format(item.total)}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(item, item.quantity - 1)}>
                      <Ionicons name="remove" size={18} color={theme.text} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.qtyInput}
                      value={String(item.quantity)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      onChangeText={(text) => setQuantityDirect(item, text)}
                      accessibilityLabel={`Quantity for ${item.name}`}
                    />
                    <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(item, item.quantity + 1)}>
                      <Ionicons name="add" size={18} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.removeButton} onPress={() => setCart((items) => removeCartItem(items, item.id))}>
                    <Ionicons name="close" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </AppCard>
      </View>

      {/* Browse inventory picker */}
      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Browse products</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <SearchBar theme={theme} placeholder="Search products" value={pickerQuery} onChangeText={setPickerQuery} />
            <FlatList
              data={pickerProducts}
              keyExtractor={(item) => item.barcode}
              keyboardShouldPersistTaps="handled"
              style={styles.pickerList}
              ListEmptyComponent={<AppEmptyState theme={theme} title="No products" message="Try another search." />}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => addProduct(item, 'tap')}>
                  <View style={styles.cartInfo}>
                    <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cartMeta}>{item.barcode} · Stock {item.quantity}</Text>
                  </View>
                  <Text style={styles.searchPrice}>{currency.format(item.price)}</Text>
                  <Ionicons name="add-circle" size={24} color={theme.primary} style={{ marginLeft: 10 }} />
                </TouchableOpacity>
              )}
            />
            <AppButton label="Done" theme={theme} onPress={() => setShowPicker(false)} />
          </View>
        </View>
      </Modal>

      <BarcodeInputModal
        visible={showManualInput}
        onClose={() => setShowManualInput(false)}
        onSubmit={(barcode) => {
          setShowManualInput(false);
          void addBarcode(barcode, 'manual');
        }}
        theme={theme}
      />
    </AppScreen>
  );
};

const toastToneStyle = (theme: Theme, tone: 'success' | 'warning' | 'danger') => {
  const dark = theme.mode === 'dark';
  if (tone === 'success') return { backgroundColor: dark ? '#14532d' : '#dcfce7' };
  if (tone === 'warning') return { backgroundColor: dark ? '#78350f' : '#fef3c7' };
  return { backgroundColor: dark ? '#7f1d1d' : '#fee2e2' };
};

const toastToneText = (theme: Theme, tone: 'success' | 'warning' | 'danger') => {
  const dark = theme.mode === 'dark';
  if (dark) return '#ffffff';
  if (tone === 'success') return '#166534';
  if (tone === 'warning') return '#92400e';
  return '#991b1b';
};

const createStyles = (theme: Theme) => StyleSheet.create({
  // Gutters and footer clearance come from AppScreen, which measures the real
  // action-bar height instead of guessing at a fixed offset.
  root: { flex: 1, gap: 10 },
  scannerArea: {
    height: 168,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  camera: { flex: 1 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  permissionText: { color: '#ffffff', ...typography.caption, textAlign: 'center' },
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastText: { ...typography.caption },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.cardBackground,
  },
  actionChipText: { color: theme.primary, ...typography.caption, fontWeight: '700' },
  searchPanel: { padding: 10, maxHeight: 132 },
  searchResult: {
    width: 154,
    minHeight: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.divider,
    padding: 10,
    marginRight: 8,
    backgroundColor: theme.inputBackground,
  },
  searchName: { color: theme.text, ...typography.bodyStrong },
  searchMeta: { color: theme.textSecondary, ...typography.caption, marginTop: 4 },
  searchPrice: { color: theme.primary, ...typography.caption, marginTop: 4 },
  cartPanel: { flex: 1, padding: 12 },
  cartRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingVertical: 8,
  },
  cartInfo: { flex: 1 },
  cartName: { color: theme.text, ...typography.bodyStrong },
  cartMeta: { color: theme.textSecondary, ...typography.caption },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    minWidth: 40,
    height: 34,
    textAlign: 'center',
    color: theme.text,
    fontWeight: '800',
    fontSize: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.divider,
    backgroundColor: theme.background,
    paddingVertical: 0,
  },
  removeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footerLabel: { color: theme.textSecondary, ...typography.caption },
  footerTotal: { color: theme.text, ...typography.stat },
  reviewButton: { minWidth: 150 },
  // Picker
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '82%',
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pickerTitle: { color: theme.text, ...typography.sectionTitle },
  pickerList: { marginTop: 10, marginBottom: 12 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
});

export default BillingScreen;
