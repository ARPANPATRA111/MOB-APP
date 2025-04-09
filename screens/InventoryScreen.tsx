import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image,
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

interface Item {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  imageUri?: string; // Path to image in filesystem
}

const InventoryScreen: React.FC = () => {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPrice, setEditedPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [imageCache, setImageCache] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    loadInventory();
  }, []);

  // Function to check if an image file exists
  const checkImageExists = async (uri: string): Promise<boolean> => {
    if (!uri) return false;
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.exists;
    } catch (error) {
      console.error('Error checking if image exists:', error);
      return false;
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      const inventoryJSON = await AsyncStorage.getItem('inventory');
      
      if (inventoryJSON) {
        const items = JSON.parse(inventoryJSON) as Item[];
        setInventory(items);
        
        // Verify image existence for each item
        const newImageCache = {...imageCache};
        
        for (const item of items) {
          if (item.imageUri) {
            const exists = await checkImageExists(item.imageUri);
            newImageCache[item.barcode] = exists;
          }
        }
        
        setImageCache(newImageCache);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory');
    } finally {
      setLoading(false);
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

  const openItemDetails = (item: Item) => {
    setSelectedItem(item);
    setEditedName(item.name);
    setEditedPrice(item.price.toString());
    setEditedQuantity(item.quantity.toString());
    setIsModalVisible(true);
  };

  // Function to pick an image from the device gallery
  const pickImage = async () => {
    try {
      // Request permission to access the photo library
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change product image');
        return;
      }
      
      // Open image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        if (selectedItem) {
          await updateProductImage(selectedItem.barcode, selectedAsset.uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  // Function to update product image
  const updateProductImage = async (barcode: string, sourceUri: string) => {
    try {
      // Create unique filename for the image
      const fileName = `product_${barcode}_${Date.now()}.jpg`;
      const destinationUri = `${FileSystem.documentDirectory}images/${fileName}`;
      
      // Ensure the directory exists
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}images`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}images`, { intermediates: true });
      }
      
      // Delete old image if it exists
      if (selectedItem?.imageUri) {
        try {
          await deleteImageFile(selectedItem.imageUri);
        } catch (error) {
          console.error('Error deleting old image:', error);
          // Continue with the update even if delete fails
        }
      }
      
      // Copy the new image to app's directory
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri
      });
      
      // Update inventory with new image path
      const updatedInventory = inventory.map(item => 
        item.barcode === barcode 
        ? {...item, imageUri: destinationUri}
        : item
      );
      
      // Update imageCache
      setImageCache({ ...imageCache, [barcode]: true });
      
      // Save updated inventory
      await saveInventory(updatedInventory);
      
      // Update selected item in state
      if (selectedItem) {
        const updatedItem = { ...selectedItem, imageUri: destinationUri };
        setSelectedItem(updatedItem);
      }
      
      Alert.alert('Success', 'Product image updated');
    } catch (error) {
      console.error('Error updating product image:', error);
      Alert.alert('Error', 'Failed to update product image');
    }
  };

  const saveItemChanges = () => {
    if (!selectedItem) return;
    
    if (!editedName.trim()) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }
    
    const priceValue = parseFloat(editedPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }
    
    const quantityValue = parseInt(editedQuantity);
    if (isNaN(quantityValue) || quantityValue < 0) {
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

  const openRemoveModal = () => {
    if (!selectedItem) return;
    setRemoveQuantity('');
    setIsRemoveModalVisible(true);
  };

  const removeEntireItem = () => {
    if (!selectedItem) return;
    
    Alert.alert(
      'Remove Product',
      `Are you sure you want to remove ${selectedItem.name} completely?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Delete image file if it exists
            if (selectedItem.imageUri) {
              try {
                await deleteImageFile(selectedItem.imageUri);
              } catch (err) {
                console.error('Failed to delete image file:', err);
                // Continue anyway - we'll still remove from inventory
              }
            }
            
            // Remove from inventory
            const updatedInventory = inventory.filter(item => item.barcode !== selectedItem.barcode);
            saveInventory(updatedInventory);
            
            // Store barcode in deleted products list
            await storeDeletedBarcode(selectedItem.barcode);
            
            setIsRemoveModalVisible(false);
            setIsModalVisible(false);
            setSelectedItem(null);
          }
        }
      ]
    );
  };


  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity 
      style={styles.itemContainer}
      onPress={() => openItemDetails(item)}
    >
      <View style={styles.itemContent}>
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
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemQuantity}>In stock: {item.quantity}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a89dc" />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      
      {/* Edit Item Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView>
              <Text style={styles.modalTitle}>Product Details</Text>
              
              <TouchableOpacity 
                style={styles.imageContainer} 
                onPress={pickImage}
              >
                {selectedItem?.imageUri ? (
                  <>
                    <Image 
                      source={{ uri: selectedItem.imageUri }}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
                    <View style={styles.changeImageButton}>
                      <Text style={styles.changeImageText}>Change Image</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <Text style={styles.largePlaceholderText}>
                      {selectedItem?.name.substring(0, 2)}
                    </Text>
                    <Text style={styles.changeImageText}>Tap to add image</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <Text style={styles.barcodeText}>Barcode: {selectedItem?.barcode}</Text>
              
              <Text style={styles.inputLabel}>Product Name</Text>
              <TextInput
                style={styles.input}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Product Name"
              />
              
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                value={editedQuantity}
                onChangeText={setEditedQuantity}
                keyboardType="numeric"
                placeholder="0"
              />
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Remove Item Modal */}
      <Modal
        visible={isRemoveModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsRemoveModalVisible(false)}
      >

      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 16,
    backgroundColor: '#4a89dc',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContainer: {
    padding: 8,
  },
  itemContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginVertical: 6,
    marginHorizontal: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InventoryScreen;