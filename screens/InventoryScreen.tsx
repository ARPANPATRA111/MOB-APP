// InventoryScreen.tsx

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import type { AppNavigation } from '../App';
import { storageService } from '../src/services/storage';
import { fuzzySearchProducts, paginate } from '../src/domain/search';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { useToast } from '../src/components/ui/ToastProvider';
import { useDialog } from '../src/components/ui/DialogProvider';
import AppScreen from '../src/components/ui/AppScreen';
import SearchBar from '../src/components/ui/SearchBar';
import { Skeleton, useDelayedFlag } from '../src/components/ui/Skeleton';
import { typography } from '../src/theme/typography';

interface Item {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  imageUri?: string;
}

type StockFilter = 'all' | 'in' | 'low' | 'out';
type SortBy = 'name' | 'price-desc' | 'price-asc' | 'stock-asc';

const LOW_STOCK_THRESHOLD = 5;
const inventoryHeaderAddStyle = { paddingHorizontal: 12, paddingVertical: 6 } as const;

const InventoryScreen: React.FC<{ navigation: AppNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const currency = useCurrency();
  const toast = useToast();
  const dialog = useDialog();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();

  const [inventory, setInventory] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPrice, setEditedPrice] = useState('');
  const [editedQuantity, setEditedQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('Stock count correction');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 220);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedFlag(loading);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [filterVisible, setFilterVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const loadInventory = useCallback(async () => {
    setRefreshing(true);
    try {
      const items = await storageService.getInventory();
      setInventory(items);
    } catch (error) {
      console.error('Error loading inventory:', error);
      void dialog.alert({ title: 'Inventory unavailable', message: 'Failed to load inventory.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dialog]);

  const loadCategories = useCallback(async () => {
    try {
      const storedCategories = await storageService.getCategories();
      if (storedCategories.length > 0) {
        setCategories(['All', ...storedCategories]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
    void loadCategories();
  }, [loadInventory, loadCategories]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add product"
          style={inventoryHeaderAddStyle}
          onPress={() => navigation.navigate('AddItem')}
        >
          <Ionicons name="add" size={26} color={theme.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme]);

  const saveInventory = async (updatedInventory: Item[]) => {
    try {
      await storageService.saveInventory(updatedInventory);
      setInventory(updatedInventory);
    } catch (error) {
      console.error('Error saving inventory:', error);
      void dialog.alert({ title: 'Save failed', message: 'Failed to save inventory changes.' });
    }
  };

  const activeFilterCount =
    (selectedCategory !== 'All' ? 1 : 0) + (stockFilter !== 'all' ? 1 : 0) + (sortBy !== 'name' ? 1 : 0);

  const filteredInventory = useMemo(() => {
    let filtered = fuzzySearchProducts(inventory, debouncedSearch);

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(
        (item) => item.category === selectedCategory || (!item.category && selectedCategory === 'Uncategorized')
      );
    }

    if (stockFilter === 'in') {
      filtered = filtered.filter((item) => item.quantity > LOW_STOCK_THRESHOLD);
    } else if (stockFilter === 'low') {
      filtered = filtered.filter((item) => item.quantity > 0 && item.quantity <= LOW_STOCK_THRESHOLD);
    } else if (stockFilter === 'out') {
      filtered = filtered.filter((item) => item.quantity <= 0);
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'stock-asc':
        sorted.sort((a, b) => a.quantity - b.quantity);
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [inventory, debouncedSearch, selectedCategory, stockFilter, sortBy]);

  const visibleInventory = useMemo(
    () => paginate(filteredInventory, { page: 1, pageSize: page * 40 }),
    [filteredInventory, page]
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, stockFilter, sortBy]);

  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectionMode(false);
  };

  const toggleItemSelection = (barcode: string) => {
    setSelectionMode(true);
    setSelectedItems((current) => {
      const next = new Set(current);
      if (next.has(barcode)) {
        next.delete(barcode);
      } else {
        next.add(barcode);
      }
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  };

  const bulkDeleteItems = async () => {
    if (selectedItems.size === 0) return;
    const confirmed = await dialog.confirm({
      title: 'Delete products',
      message: `Delete ${selectedItems.size} selected product${selectedItems.size > 1 ? 's' : ''}? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!confirmed) return;
    const removed = selectedItems.size;
    const updatedInventory = inventory.filter((item) => !selectedItems.has(item.barcode));
    await saveInventory(updatedInventory);
    clearSelection();
    toast.showToast({ message: `${removed} product${removed > 1 ? 's' : ''} deleted`, variant: 'success' });
  };

  const openItemDetails = (item: Item) => {
    setSelectedItem(item);
    setEditedName(item.name);
    setEditedPrice(item.price.toString());
    setEditedQuantity(item.quantity.toString());
    setAdjustmentReason('Stock count correction');
    setIsModalVisible(true);
  };

  const saveItemChanges = async () => {
    if (!selectedItem) return;

    if (!editedName.trim()) {
      void dialog.alert({ title: 'Name required', message: 'Please enter a product name.' });
      return;
    }

    const priceValue = parseFloat(editedPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      void dialog.alert({ title: 'Invalid price', message: 'Please enter a valid price.' });
      return;
    }

    const quantityValue = parseInt(editedQuantity, 10);
    if (isNaN(quantityValue) || quantityValue < 0) {
      void dialog.alert({ title: 'Invalid quantity', message: 'Please enter a valid quantity.' });
      return;
    }

    if (quantityValue !== selectedItem.quantity && !adjustmentReason.trim()) {
      void dialog.alert({ title: 'Reason required', message: 'Please enter why this stock quantity changed.' });
      return;
    }

    const updatedItem: Item = {
      ...selectedItem,
      name: editedName.trim(),
      price: priceValue,
      quantity: quantityValue,
    };

    const updatedInventory = inventory.map((item) => (item.barcode === selectedItem.barcode ? updatedItem : item));

    try {
      await storageService.updateInventoryItem(updatedItem, adjustmentReason.trim());
      setInventory(updatedInventory);
      setIsModalVisible(false);
      setSelectedItem(null);
      toast.showToast({ message: 'Product updated', variant: 'success' });
    } catch (error) {
      void dialog.alert({ title: 'Save failed', message: (error as Error).message });
    }
  };

  const confirmDeleteItem = async (item: Item) => {
    const confirmed = await dialog.confirm({
      title: 'Remove product',
      message: `Remove "${item.name}" from inventory?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (confirmed) {
      await deleteItem(item);
    }
  };

  const deleteItem = async (item: Item) => {
    try {
      if (item.imageUri) {
        await FileSystem.deleteAsync(item.imageUri, { idempotent: true });
      }
      const updatedInventory = inventory.filter((i) => i.barcode !== item.barcode);
      await saveInventory(updatedInventory);
      setSelectedItems((current) => {
        const next = new Set(current);
        next.delete(item.barcode);
        return next;
      });
      toast.showToast({ message: `${item.name} deleted`, variant: 'success' });
    } catch (error) {
      console.error('Error deleting item:', error);
      void dialog.alert({ title: 'Delete failed', message: 'Failed to delete product.' });
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const isSelected = selectedItems.has(item.barcode);
    const isLow = item.quantity <= LOW_STOCK_THRESHOLD;
    return (
      <TouchableOpacity
        style={[styles.itemContainer, isSelected && styles.selectedItem, isLow && styles.lowStockItem]}
        onPress={() => (selectionMode ? toggleItemSelection(item.barcode) : openItemDetails(item))}
        onLongPress={() => toggleItemSelection(item.barcode)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.quantity} in stock`}
      >
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.placeholderText}>{item.name.substring(0, 2)}</Text>
          </View>
        )}
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemBarcode}>{item.barcode}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemPrice}>{currency.format(item.price)}</Text>
            <Text style={[styles.itemQuantity, isLow && styles.lowStockText]}>Qty: {item.quantity}</Text>
          </View>
        </View>
        {selectionMode ? (
          <Ionicons
            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isSelected ? theme.primary : theme.textSecondary}
            style={styles.rowActionIcon}
          />
        ) : (
          <View style={styles.rowActions}>
            <TouchableOpacity
              style={styles.rowActionBtn}
              accessibilityLabel={`Edit ${item.name}`}
              onPress={() => openItemDetails(item)}
            >
              <Ionicons name="create-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowActionBtn}
              accessibilityLabel={`Delete ${item.name}`}
              onPress={() => confirmDeleteItem(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <AppScreen theme={theme} scroll={false}>
        {showSkeleton ? (
          <View style={{ paddingTop: 4 }}>
            <Skeleton theme={theme} height={50} radius={8} style={{ marginBottom: 12 }} />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} theme={theme} height={82} radius={10} style={{ marginBottom: 10 }} />
            ))}
          </View>
        ) : null}
      </AppScreen>
    );
  }

  return (
    <AppScreen theme={theme} scroll={false}>
      <SearchBar
        theme={theme}
        placeholder="Search products by name or barcode"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <View style={styles.controlsRow}>
        <Text style={styles.countText}>{filteredInventory.length} products</Text>
        <TouchableOpacity style={styles.filterButton} onPress={() => setFilterVisible(true)} accessibilityRole="button">
          <Ionicons name="options-outline" size={16} color={theme.primary} />
          <Text style={styles.filterButtonText}>Filters</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {selectionMode ? (
        <View style={styles.bulkActions}>
          <Text style={styles.bulkActionText}>{selectedItems.size} selected</Text>
          <View style={styles.bulkButtons}>
            <TouchableOpacity onPress={clearSelection} style={styles.bulkClearBtn}>
              <Text style={styles.bulkClearText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkDeleteButton} onPress={bulkDeleteItems}>
              <Ionicons name="trash-outline" size={18} color="#ffffff" />
              <Text style={styles.bulkDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <FlatList
        data={visibleInventory}
        renderItem={renderItem}
        keyExtractor={(item) => item.barcode}
        initialNumToRender={14}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews
        // AppScreen already clears the tab bar; this is just trailing breathing room.
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadInventory} colors={[theme.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No products found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || activeFilterCount > 0 ? 'Try a different search or filter' : 'Tap + to add your first product'}
            </Text>
          </View>
        }
        ListFooterComponent={
          visibleInventory.length < filteredInventory.length ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={() => setPage((current) => current + 1)}>
              <Text style={styles.loadMoreText}>Load more products</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Filter bottom sheet */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setFilterVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filters & sorting</Text>

            <Text style={styles.sheetLabel}>Stock status</Text>
            <View style={styles.chipRow}>
              {([
                { label: 'All', value: 'all' },
                { label: 'In stock', value: 'in' },
                { label: 'Low', value: 'low' },
                { label: 'Out', value: 'out' },
              ] as { label: string; value: StockFilter }[]).map((option) => (
                <Chip
                  key={option.value}
                  theme={theme}
                  label={option.label}
                  active={stockFilter === option.value}
                  onPress={() => setStockFilter(option.value)}
                />
              ))}
            </View>

            {categories.length > 1 ? (
              <>
                <Text style={styles.sheetLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {categories.map((category) => (
                    <Chip
                      key={category}
                      theme={theme}
                      label={category}
                      active={selectedCategory === category}
                      onPress={() => setSelectedCategory(category)}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.sheetLabel}>Sort by</Text>
            <View style={styles.chipRow}>
              {([
                { label: 'Name', value: 'name' },
                { label: 'Price: high', value: 'price-desc' },
                { label: 'Price: low', value: 'price-asc' },
                { label: 'Stock: low first', value: 'stock-asc' },
              ] as { label: string; value: SortBy }[]).map((option) => (
                <Chip
                  key={option.value}
                  theme={theme}
                  label={option.label}
                  active={sortBy === option.value}
                  onPress={() => setSortBy(option.value)}
                />
              ))}
            </View>

            <View style={styles.sheetButtons}>
              <TouchableOpacity
                style={styles.sheetClear}
                onPress={() => {
                  setStockFilter('all');
                  setSelectedCategory('All');
                  setSortBy('name');
                }}
              >
                <Text style={styles.sheetClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetApply} onPress={() => setFilterVisible(false)}>
                <Text style={styles.sheetApplyText}>Show {filteredInventory.length} products</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Item Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit product</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)} accessibilityLabel="Close">
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              {selectedItem?.imageUri ? (
                <Image source={{ uri: selectedItem.imageUri }} style={styles.modalImage} resizeMode="contain" />
              ) : (
                <View style={styles.modalImagePlaceholder}>
                  <Ionicons name="image" size={48} color={theme.textSecondary} />
                </View>
              )}

              <Text style={styles.modalLabel}>Barcode</Text>
              <Text style={styles.modalValue}>{selectedItem?.barcode}</Text>

              <Text style={styles.modalLabel}>Product name</Text>
              <TextInput
                style={styles.modalInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Product name"
                placeholderTextColor={theme.placeholder}
              />

              <View style={styles.modalRow}>
                <View style={styles.modalColumn}>
                  <Text style={styles.modalLabel}>Price ({currency.symbol.trim()})</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedPrice}
                    onChangeText={setEditedPrice}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
                <View style={styles.modalColumn}>
                  <Text style={styles.modalLabel}>Quantity</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedQuantity}
                    onChangeText={setEditedQuantity}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
              </View>

              <Text style={styles.modalLabel}>Stock adjustment reason</Text>
              <TextInput
                style={styles.modalInput}
                value={adjustmentReason}
                onChangeText={setAdjustmentReason}
                placeholder="Required when quantity changes"
                placeholderTextColor={theme.placeholder}
              />

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                  <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveItemChanges}>
                  <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Save changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
};

const Chip = ({
  theme,
  label,
  active,
  onPress,
}: {
  theme: Theme;
  label: string;
  active: boolean;
  onPress: () => void;
}) => {
  const styles = createStyles(theme);
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      marginBottom: 6,
    },
    countText: { color: theme.textSecondary, ...typography.caption },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.cardBackground,
    },
    filterButtonText: { color: theme.primary, ...typography.caption, fontWeight: '700' },
    filterCount: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterCountText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
    bulkActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    bulkActionText: { color: theme.text, ...typography.bodyStrong },
    bulkButtons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    bulkClearBtn: { paddingHorizontal: 12, paddingVertical: 8 },
    bulkClearText: { color: theme.textSecondary, ...typography.bodyStrong },
    bulkDeleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#dc2626',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    bulkDeleteText: { color: '#ffffff', ...typography.bodyStrong },
    listContainer: { paddingTop: 4, paddingBottom: 16 },
    loadMoreButton: {
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.divider,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      backgroundColor: theme.cardBackground,
    },
    loadMoreText: { color: theme.primary, ...typography.bodyStrong },
    itemContainer: {
      flexDirection: 'row',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      marginBottom: 10,
      padding: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.divider,
    },
    selectedItem: { borderColor: theme.primary, borderWidth: 2 },
    lowStockItem: { borderLeftWidth: 4, borderLeftColor: theme.mode === 'dark' ? '#fbbf24' : '#f59e0b' },
    productImage: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
    productImagePlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: theme.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    placeholderText: { fontSize: 18, fontWeight: 'bold', color: theme.textSecondary, textTransform: 'uppercase' },
    itemDetails: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '800', color: theme.text, marginBottom: 2 },
    itemBarcode: { fontSize: 12, color: theme.textSecondary, marginBottom: 5 },
    itemMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    itemPrice: { fontSize: 15, fontWeight: 'bold', color: theme.primary },
    itemQuantity: { fontSize: 14, color: theme.text },
    lowStockText: { color: theme.mode === 'dark' ? '#fbbf24' : '#b45309', fontWeight: 'bold' },
    rowActions: { flexDirection: 'row', marginLeft: 6 },
    rowActionBtn: { padding: 8 },
    rowActionIcon: { marginLeft: 8 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 18, color: theme.text, marginTop: 15, fontWeight: '700' },
    emptySubtext: { fontSize: 14, color: theme.textSecondary, marginTop: 5, textAlign: 'center' },
    // Filter sheet
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.cardBackground,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.divider,
      alignSelf: 'center',
      marginBottom: 14,
    },
    sheetTitle: { color: theme.text, ...typography.sectionTitle, marginBottom: 14 },
    sheetLabel: { color: theme.textSecondary, ...typography.caption, marginTop: 12, marginBottom: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      minHeight: 36,
      borderRadius: 20,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.inputBackground,
    },
    chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { color: theme.textSecondary, fontSize: 13, fontWeight: '700' },
    chipTextActive: { color: '#ffffff' },
    sheetButtons: { flexDirection: 'row', gap: 12, marginTop: 22 },
    sheetClear: {
      flex: 1,
      minHeight: 48,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetClearText: { color: theme.text, ...typography.button },
    sheetApply: {
      flex: 2,
      minHeight: 48,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetApplyText: { color: '#ffffff', ...typography.button },
    // Edit modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContainer: {
      width: '90%',
      maxHeight: '85%',
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      overflow: 'hidden',
    },
    modalContent: { padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    modalTitle: { fontSize: 19, fontWeight: 'bold', color: theme.text },
    modalImage: { width: '100%', height: 180, borderRadius: 8, marginBottom: 18, backgroundColor: theme.inputBackground },
    modalImagePlaceholder: {
      width: '100%',
      height: 140,
      borderRadius: 8,
      backgroundColor: theme.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 18,
    },
    modalLabel: { fontSize: 13, color: theme.textSecondary, marginBottom: 6 },
    modalValue: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 15,
      padding: 10,
      backgroundColor: theme.inputBackground,
      borderRadius: 8,
    },
    modalInput: {
      backgroundColor: theme.inputBackground,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      marginBottom: 15,
    },
    modalRow: { flexDirection: 'row', justifyContent: 'space-between' },
    modalColumn: { width: '48%' },
    modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 12 },
    modalButton: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
    cancelButton: { backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.divider },
    saveButton: { backgroundColor: theme.primary },
    modalButtonText: { fontWeight: 'bold', fontSize: 15 },
  });

export default InventoryScreen;
