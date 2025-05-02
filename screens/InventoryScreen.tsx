// InventoryScreen.tsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import {Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../src/contexts/ThemeContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { Swipeable } from 'react-native-gesture-handler';

interface Item {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  imageUri?: string;
}

const InventoryScreen: React.FC<{ navigation: StackNavigationProp<RootStackParamList, 'Inventory'> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const [inventory, setInventory] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPrice, setEditedPrice] = useState('');
  const [editedQuantity, setEditedQuantity] = useState('');
  const [removeQuantity, setRemoveQuantity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInventory();
    loadCategories();
  }, []);

  const loadInventory = async () => {
    setRefreshing(true);
    try {
      const inventoryJSON = await AsyncStorage.getItem('inventory');
      if (inventoryJSON) {
        const items = JSON.parse(inventoryJSON) as Item[];
        setInventory(items);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesJSON = await AsyncStorage.getItem('categories');
      if (categoriesJSON) {
        setCategories(['All', ...JSON.parse(categoriesJSON)]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const saveInventory = async (updatedInventory: Item[]) => {
    try {
      await AsyncStorage.setItem('inventory', JSON.stringify(updatedInventory));
      setInventory(updatedInventory);
    } catch (error) {
      console.error('Error saving inventory:', error);
      Alert.alert('Error', 'Failed to save inventory changes');
    }
  };

  const filteredInventory = useMemo(() => {
    let filtered = inventory.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery)
    );

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => 
        item.category === selectedCategory || 
        (!item.category && selectedCategory === 'Uncategorized')
      );
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, searchQuery, selectedCategory]);

  const toggleItemSelection = (barcode: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(barcode)) {
      newSelection.delete(barcode);
    } else {
      newSelection.add(barcode);
    }
    setSelectedItems(newSelection);
  };

  const bulkDeleteItems = async () => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      'Confirm Delete',
      `Delete ${selectedItems.size} selected items?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedInventory = inventory.filter(
              item => !selectedItems.has(item.barcode)
            );
            await saveInventory(updatedInventory);
            setSelectedItems(new Set());
          }
        }
      ]
    );
  };

  const openItemDetails = (item: Item) => {
    setSelectedItem(item);
    setEditedName(item.name);
    setEditedPrice(item.price.toString());
    setEditedQuantity(item.quantity.toString());
    setIsModalVisible(true);
  };

  const saveItemChanges = () => {
    if (!selectedItem) return;
    
    if (!editedName.trim()) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }
    
    const priceValue = parseFloat(editedPrice);
    if (isNaN(priceValue)) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    
    const quantityValue = parseInt(editedQuantity);
    if (isNaN(quantityValue)) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }
    
    const updatedItem: Item = {
      ...selectedItem,
      name: editedName,
      price: priceValue,
      quantity: quantityValue
    };
    
    const updatedInventory = inventory.map(item => 
      item.barcode === selectedItem.barcode ? updatedItem : item
    );
    
    saveInventory(updatedInventory);
    setIsModalVisible(false);
    setSelectedItem(null);
  };

  const renderRightActions = (item: Item) => (
    <TouchableOpacity
      style={styles.deleteSwipeAction}
      onPress={() => confirmDeleteItem(item)}
    >
      <Ionicons name="trash-outline" size={40} color="white" />
    </TouchableOpacity>
  );

  const confirmDeleteItem = (item: Item) => {
    Alert.alert(
      'Remove Product',
      `Are you sure you want to remove ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteItem(item)
        }
      ]
    );
  };

  const deleteItem = async (item: Item) => {
    try {
      // Delete image file if it exists
      if (item.imageUri) {
        await FileSystem.deleteAsync(item.imageUri, { idempotent: true });
      }
      
      // Remove from inventory
      const updatedInventory = inventory.filter(i => i.barcode !== item.barcode);
      await saveInventory(updatedInventory);
      
      // Remove from selection if it was selected
      const newSelection = new Set(selectedItems);
      newSelection.delete(item.barcode);
      setSelectedItems(newSelection);
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const renderItem = ({ item }: { item: Item }) => (
    <Swipeable renderRightActions={() => renderRightActions(item)}>
      <TouchableOpacity 
        style={[
          styles.itemContainer,
          selectedItems.has(item.barcode) && styles.selectedItem,
          item.quantity <= 5 && styles.lowStockItem
        ]}
        onPress={() => toggleItemSelection(item.barcode)}
        onLongPress={() => openItemDetails(item)}
      >
        {item.imageUri ? (
          <Image 
            source={{ uri: item.imageUri }} 
            style={styles.productImage} 
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.placeholderText}>{item.name.substring(0, 2)}</Text>
          </View>
        )}
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemBarcode}>{item.barcode}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            <Text style={[
              styles.itemQuantity,
              item.quantity <= 5 && styles.lowStockText
            ]}>
              Qty: {item.quantity}
            </Text>
          </View>
          {item.category && (
            <Text style={styles.itemCategory}>{item.category}</Text>
          )}
        </View>
        {selectedItems.has(item.barcode) && (
          <View style={styles.selectedIndicator}>
            <Ionicons name="checkmark-circle-outline" size={24} color={theme.primary} />
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
          placeholderTextColor={theme.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

      </View>

      {selectedItems.size > 0 && (
        <View style={styles.bulkActions}>
          <Text style={styles.bulkActionText}>
            {selectedItems.size} selected
          </Text>
          <TouchableOpacity
            style={styles.bulkDeleteButton}
            onPress={bulkDeleteItems}
          >
            <Ionicons name="trash-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredInventory}
        renderItem={renderItem}
        keyExtractor={item => item.barcode}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadInventory}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search' : 'Add items to get started'}
            </Text>
          </View>
        }
      />

      {/* Edit Item Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Product</Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              {selectedItem?.imageUri ? (
                <Image 
                  source={{ uri: selectedItem.imageUri }} 
                  style={styles.modalImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.modalImagePlaceholder}>
                  <Ionicons name="image" size={48} color={theme.textSecondary} />
                </View>
              )}

              <Text style={styles.modalLabel}>Barcode</Text>
              <Text style={styles.modalValue}>{selectedItem?.barcode}</Text>

              <Text style={styles.modalLabel}>Product Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Product name"
                placeholderTextColor={theme.placeholder}
              />

              <View style={styles.modalRow}>
                <View style={styles.modalColumn}>
                  <Text style={styles.modalLabel}>Price ($)</Text>
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

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveItemChanges}
                >
                  <Text style={styles.modalButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.text,
  },
  searchContainer: {
    paddingTop: 15,
    paddingHorizontal: 20,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  searchInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 8,
    fontSize: 16,
    color: theme.text,
  },
  bulkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: theme.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  bulkActionText: {
    color: theme.text,
    fontSize: 16,
  },
  bulkDeleteButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 20,
  },
  listContainer: {
    padding: 10,
  },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: theme.cardBackground,
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedItem: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  lowStockItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 3,
  },
  itemBarcode: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
  },
  itemQuantity: {
    fontSize: 14,
    color: theme.text,
  },
  lowStockText: {
    color: '#ff9800',
    fontWeight: 'bold',
  },
  itemCategory: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 3,
    fontStyle: 'italic',
  },
  selectedIndicator: {
    marginLeft: 10,
  },
  deleteSwipeAction: {
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    width: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: theme.text,
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: theme.cardBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: theme.inputBackground,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  modalValue: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 15,
    padding: 10,
    backgroundColor: theme.inputBackground,
    borderRadius: 5,
  },
  modalInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    color: theme.text,
    marginBottom: 15,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalColumn: {
    width: '48%',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.inputBackground,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: theme.primary,
  },
  modalButtonText: {
    fontWeight: 'bold',
  },
});

export default InventoryScreen;