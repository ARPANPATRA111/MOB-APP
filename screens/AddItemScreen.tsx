// AddItemScreen.tsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal
} from 'react-native';
import { CameraView, BarcodeScanningResult, Camera } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/contexts/ThemeContext';
import { RootStackParamList } from '../App';
import BarcodeInputModal from '../src/components/BarcodeInputModal';

type AddItemScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'AddItem'>;
};

interface Item {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  category?: string;
  imageUri?: string;
}

const AddItemScreen: React.FC<AddItemScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [existingProduct, setExistingProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    (async () => {
      // Request camera permission
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(cameraStatus === 'granted');

      // Request camera roll permission
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();

      // Load sound
      await loadSound();

      // Create product images directory if it doesn't exist
      await ensureDirectoryExists();

      // Load categories
      await loadCategories();
    })();

    return () => {
      // Clean up sound when component unmounts
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesJSON = await AsyncStorage.getItem('categories');
      if (categoriesJSON) {
        setCategories(JSON.parse(categoriesJSON));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const ensureDirectoryExists = async () => {
    const directory = FileSystem.documentDirectory + 'product_images/';
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
    return directory;
  };

  const loadSound = async () => {
    try {
      // Load the sound file
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/BEEP_SOUND.mp3')
      );
      soundRef.current = sound;
      setSound(sound);
    } catch (error) {
      console.error('Error loading sound:', error);
    }
  };

  const playSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.replayAsync();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const checkRemovedBarcode = async (barcode: string): Promise<boolean> => {
    try {
      const removedBarcodesJSON = await AsyncStorage.getItem('removedBarcodes');
      if (removedBarcodesJSON) {
        const removedBarcodes: string[] = JSON.parse(removedBarcodesJSON);
        return removedBarcodes.includes(barcode);
      }
      return false;
    } catch (error) {
      console.error('Error checking removed barcodes:', error);
      return false;
    }
  };

  const removeFromRemovedBarcodes = async (barcode: string) => {
    try {
      const removedBarcodesJSON = await AsyncStorage.getItem('removedBarcodes');
      if (removedBarcodesJSON) {
        const removedBarcodes: string[] = JSON.parse(removedBarcodesJSON);
        const updatedList = removedBarcodes.filter(code => code !== barcode);
        await AsyncStorage.setItem('removedBarcodes', JSON.stringify(updatedList));
      }
    } catch (error) {
      console.error('Error updating removed barcodes list:', error);
    }
  };

  const findExistingItem = async (barcode: string): Promise<Item | null> => {
    try {
      const inventoryJSON = await AsyncStorage.getItem('inventory');
      if (inventoryJSON) {
        const inventory: Item[] = JSON.parse(inventoryJSON);
        return inventory.find(item => item.barcode === barcode) || null;
      }
      return null;
    } catch (error) {
      console.error('Error finding existing item:', error);
      return null;
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;

    setScanned(true);
    const { data, type } = result;

    console.log(`Barcode with type ${type} and data ${data} has been scanned!`);
    await processScannedBarcode(data);
  };

  const processScannedBarcode = async (barcode: string) => {
    // Play beep sound
    await playSound();

    // Reset state
    setExistingProduct(false);

    // Check if barcode was previously removed
    const wasRemoved = await checkRemovedBarcode(barcode);

    // Check if this item exists in inventory (and wasn't previously removed)
    if (!wasRemoved) {
      const existingItem = await findExistingItem(barcode);

      if (existingItem) {
        // Auto-fill fields from existing item
        setItemName(existingItem.name);
        setPrice(existingItem.price.toString());
        setQuantity('1');
        setSelectedCategory(existingItem.category || '');
        setExistingProduct(true);

        Alert.alert(
          'Product Found',
          `"${existingItem.name}" already exists in inventory with ${existingItem.quantity} units.`,
          [{ text: 'OK' }]
        );
      } else {
        // New product
        setItemName('');
        setPrice('');
        setQuantity('1');
        setSelectedCategory('');
      }
    } else {
      // Previously removed product is treated as new
      setItemName('');
      setPrice('');
      setQuantity('1');
      setSelectedCategory('');
    }

    // Create initial item object
    const scanResult: Item = {
      barcode,
      name: '',
      quantity: 1,
      price: 0,
      category: selectedCategory
    };

    setScannedItem(scanResult);
    setProductImage(null);
  };

  const captureProductImage = async () => {
    try {
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Compress the image
        const compressed = await compressImage(result.assets[0].uri);
        setProductImage(compressed);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const pickProductImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const compressed = await compressImage(result.assets[0].uri);
        setProductImage(compressed);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  };

  const saveImageToStorage = async (barcode: string, imageUri: string): Promise<string> => {
    try {
      const fileName = `product_${barcode}.jpg`;
      const directory = await ensureDirectoryExists();
      const newUri = directory + fileName;

      // Check if a previous image exists and delete it
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(newUri, { idempotent: true });
      }

      // Copy the new image
      await FileSystem.copyAsync({
        from: imageUri,
        to: newUri
      });

      return newUri;
    } catch (error) {
      console.error('Error saving image:', error);
      return imageUri;
    }
  };

  const addItemToInventory = async () => {
    if (!scannedItem) return;

    // Validate inputs
    if (!itemName.trim()) {
      Alert.alert('Invalid Input', 'Please enter a product name');
      return;
    }

    const quantityNum = parseInt(quantity, 10);
    const priceNum = parseFloat(price);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid quantity');
      return;
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid price');
      return;
    }

    setLoading(true);

    try {
      // Check if barcode was previously removed
      const wasRemoved = await checkRemovedBarcode(scannedItem.barcode);

      // Process image if exists
      let savedImageUri = undefined;
      if (productImage) {
        savedImageUri = await saveImageToStorage(scannedItem.barcode, productImage);
      }

      // Get existing inventory
      const inventoryJSON = await AsyncStorage.getItem('inventory');
      let inventory: Item[] = inventoryJSON ? JSON.parse(inventoryJSON) : [];

      // Create item with user values
      const itemToAdd: Item = {
        ...scannedItem,
        name: itemName.trim(),
        price: priceNum,
        quantity: quantityNum,
        category: selectedCategory,
        imageUri: savedImageUri
      };

      // If the barcode was previously removed, remove it from the removed list
      if (wasRemoved) {
        await removeFromRemovedBarcodes(scannedItem.barcode);
        inventory.push(itemToAdd);
        await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
        showSuccessAlert('Item added to inventory as new product');
      } else {
        // Check if item already exists
        const existingItemIndex = inventory.findIndex(i => i.barcode === itemToAdd.barcode);

        if (existingItemIndex !== -1) {
          // Update existing item
          inventory[existingItemIndex] = {
            ...inventory[existingItemIndex],
            name: itemToAdd.name,
            quantity: inventory[existingItemIndex].quantity + itemToAdd.quantity,
            price: itemToAdd.price,
            category: itemToAdd.category
          };

          // Only update image if a new one was provided
          if (savedImageUri) {
            inventory[existingItemIndex].imageUri = savedImageUri;
          }

          await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
          showSuccessAlert('Item quantity updated in inventory');
        } else {
          // Add new item
          inventory.push(itemToAdd);
          await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
          showSuccessAlert('New item added to inventory');
        }
      }

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to add item to inventory');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessAlert = (message: string) => {
    Alert.alert(
      'Success',
      message,
      [
        {
          text: 'OK',
          // onPress: () => navigation.navigate('Inventory')
        }
      ]
    );
  };

  const resetForm = () => {
    setScannedItem(null);
    setScanned(false);
    setProductImage(null);
    setExistingProduct(false);
    setItemName('');
    setPrice('');
    setQuantity('1');
    setSelectedCategory('');
  };

  const handleManualBarcodeSubmit = () => {
    if (!manualBarcode.trim()) {
      Alert.alert('Error', 'Please enter a barcode');
      return;
    }
    setShowBarcodeInput(false);
    processScannedBarcode(manualBarcode);
    setManualBarcode('');
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text>No access to camera</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowBarcodeInput(true)}
        >
          <Text style={styles.buttonText}>Enter Barcode Manually</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        {!scanned ? (
          <View style={styles.scanContainer}>
            <Text style={styles.scanHeaderText}>Scan Product Barcode</Text>

            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: [
                  "qr", "ean13", "ean8", "upc_e", "code39",
                  "code128", "itf14", "codabar", "upc_a"
                ],
              }}
              onBarcodeScanned={handleBarCodeScanned}
            />

            <View style={styles.scanButtonsContainer}>
              <TouchableOpacity
                style={styles.alternateButton}
                onPress={() => {
                  setShowBarcodeInput(true)
                  handleBarCodeScanned
                  setScanned(true)
                }
                  
                }
              >
                <Text style={styles.alternateButtonText}>Enter Barcode Manually</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
            {scannedItem && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Product Information</Text>
                  <Text style={styles.barcodeText}>Barcode: {scannedItem.barcode}</Text>
                </View>

                {existingProduct && (
                  <View style={styles.existingProductBanner}>
                    <Ionicons name="information-circle" size={20} color="#fff" />
                    <Text style={styles.existingProductText}>
                      Existing product - quantity will be added
                    </Text>
                  </View>
                )}

                {/* Product Image */}
                <View style={styles.imageSection}>
                  <TouchableOpacity
                    style={styles.imageButton}
                    onPress={pickProductImage}
                    onLongPress={captureProductImage}
                  >
                    {productImage ? (
                      <Image
                        source={{ uri: productImage }}
                        style={styles.productImage}
                      />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <FontAwesome5 name="camera" size={32} color={theme.textSecondary} />
                        <Text style={styles.imagePlaceholderText}>
                          {existingProduct ? 'Update Product Image' : 'Add Product Image'}
                        </Text>
                        <Text style={styles.imagePlaceholderText}>Tap to select an image</Text>
                        <Text style={styles.imagePlaceholderText}>Hold to take a photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Product Details Form */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Product Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="Enter product name"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Price *</Text>
                    <TextInput
                      style={styles.input}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>

                  <View style={[styles.formGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Quantity *</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor={theme.placeholder}
                    />
                  </View>
                </View>

                {categories.length > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Category</Text>
                    <View style={styles.categoryContainer}>
                      {categories.map(category => (
                        <TouchableOpacity
                          key={category}
                          style={[
                            styles.categoryButton,
                            selectedCategory === category && styles.selectedCategoryButton
                          ]}
                          onPress={() => setSelectedCategory(category)}
                        >
                          <Text style={[
                            styles.categoryButtonText,
                            selectedCategory === category && styles.selectedCategoryButtonText
                          ]}>
                            {category}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={resetForm}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={addItemToInventory}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {existingProduct ? 'Update Inventory' : 'Add to Inventory'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Manual Barcode Input Modal */}
      <BarcodeInputModal
        visible={showBarcodeInput}
        onClose={() => setShowBarcodeInput(false)}
        onSubmit={(barcode) => {
          setShowBarcodeInput(false);
          processScannedBarcode(barcode);
        }}
        theme={theme}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scanContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  scanHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: theme.text,
  },
  camera: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scanButtonsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  alternateButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: theme.cardBackground,
  },
  alternateButtonText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 20,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  barcodeText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 5,
  },
  existingProductBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFA000',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  existingProductText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 14,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  imageButton: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imagePlaceholderText: {
    marginTop: 10,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.text,
  },
  input: {
    backgroundColor: theme.cardBackground,
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    color: theme.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedCategoryButton: {
    backgroundColor: theme.primary,
  },
  categoryButtonText: {
    color: theme.text,
  },
  selectedCategoryButtonText: {
    color: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  secondaryButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: theme.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddItemScreen;