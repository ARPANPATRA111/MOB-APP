// AddItemScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, BarcodeScanningResult, Camera } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { RootStackParamList } from '../App';
import BarcodeInputModal from '../src/components/BarcodeInputModal';
import { storageService } from '../src/services/storage';
import { classifyBarcode } from '../src/domain/barcode';
import { normalizeName } from '../src/domain/validation';
import { useToast } from '../src/components/ui/ToastProvider';
import { useDialog } from '../src/components/ui/DialogProvider';

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
  const toast = useToast();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [existingProduct, setExistingProduct] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const soundRef = useRef<Audio.Sound | null>(null);
  // Ref guard prevents duplicate onBarcodeScanned callbacks firing before the
  // `scanned` state commits (a real race with the camera callback).
  const processingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(cameraStatus === 'granted');
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
        await loadSound();
        await ensureDirectoryExists();
        await loadCategories();
      } catch (error) {
        console.error('Add item init failed:', error);
        setHasPermission((current) => (current === null ? false : current));
      }
    })();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadCategories = async () => {
    try {
      const storedCategories = await storageService.getCategories();
      setCategories(storedCategories);
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
      const { sound } = await Audio.Sound.createAsync(require('../assets/BEEP_SOUND.mp3'));
      soundRef.current = sound;
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
      const removedBarcodes = await storageService.getRemovedBarcodes();
      return removedBarcodes.includes(barcode);
    } catch (error) {
      console.error('Error checking removed barcodes:', error);
      return false;
    }
  };

  const removeFromRemovedBarcodes = async (barcode: string) => {
    try {
      const removedBarcodes = await storageService.getRemovedBarcodes();
      const updatedList = removedBarcodes.filter((code) => code !== barcode);
      await storageService.saveRemovedBarcodes(updatedList);
    } catch (error) {
      console.error('Error updating removed barcodes list:', error);
    }
  };

  const findExistingItem = async (barcode: string): Promise<Item | null> => {
    try {
      const inventory = await storageService.getInventory();
      return inventory.find((item) => item.barcode === barcode) || null;
    } catch (error) {
      console.error('Error finding existing item:', error);
      return null;
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (processingRef.current || scanned || showBarcodeInput) {
      return;
    }
    processingRef.current = true;

    const classification = classifyBarcode(result.data);
    if (classification.suspicious) {
      // Release the lock so the confirm dialog (which covers the camera) doesn't
      // leave the scanner permanently stuck if the user chooses to rescan.
      processingRef.current = false;
      const proceed = await dialog.confirm({
        title: 'Unusual barcode',
        message: `${classification.reason ?? 'This code looks unusual'}. Use "${classification.digits || result.data}" anyway?`,
        confirmText: 'Use anyway',
        cancelText: 'Rescan',
      });
      if (!proceed) {
        return;
      }
      processingRef.current = true;
    }

    setScanned(true);
    await processScannedBarcode(classification.digits || result.data.trim());
  };

  const processScannedBarcode = async (barcode: string) => {
    await playSound();
    setExistingProduct(false);

    const wasRemoved = await checkRemovedBarcode(barcode);

    if (!wasRemoved) {
      const existingItem = await findExistingItem(barcode);
      if (existingItem) {
        setItemName(existingItem.name);
        setPrice(existingItem.price.toString());
        setQuantity('1');
        setSelectedCategory(existingItem.category || '');
        setExistingProduct(true);
        toast.showToast({
          message: `"${existingItem.name}" exists — new quantity will be added`,
          variant: 'info',
          duration: 3200,
        });
      } else {
        setItemName('');
        setPrice('');
        setQuantity('1');
        setSelectedCategory('');
      }
    } else {
      setItemName('');
      setPrice('');
      setQuantity('1');
      setSelectedCategory('');
    }

    setScannedItem({ barcode, name: '', quantity: 1, price: 0, category: selectedCategory });
    setProductImage(null);
  };

  const captureProductImage = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProductImage(await compressImage(result.assets[0].uri));
      }
    } catch (error) {
      console.error('Error capturing image:', error);
      void dialog.alert({ title: 'Camera error', message: 'Failed to capture image.' });
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
        setProductImage(await compressImage(result.assets[0].uri));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      void dialog.alert({ title: 'Image error', message: 'Failed to select image.' });
    }
  };

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      });
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
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(newUri, { idempotent: true });
      }
      await FileSystem.copyAsync({ from: imageUri, to: newUri });
      return newUri;
    } catch (error) {
      console.error('Error saving image:', error);
      return imageUri;
    }
  };

  const addItemToInventory = async () => {
    if (!scannedItem) return;

    if (!itemName.trim()) {
      void dialog.alert({ title: 'Name required', message: 'Please enter a product name.' });
      return;
    }

    const quantityNum = parseInt(quantity, 10);
    const priceNum = parseFloat(price);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      void dialog.alert({ title: 'Invalid quantity', message: 'Please enter a valid quantity.' });
      return;
    }

    if (isNaN(priceNum) || priceNum <= 0) {
      void dialog.alert({ title: 'Invalid price', message: 'Please enter a valid price.' });
      return;
    }

    setLoading(true);

    try {
      const wasRemoved = await checkRemovedBarcode(scannedItem.barcode);

      let savedImageUri: string | undefined;
      if (productImage) {
        savedImageUri = await saveImageToStorage(scannedItem.barcode, productImage);
      }

      const inventory: Item[] = await storageService.getInventory();

      // Warn if a product with the same name but a different barcode already
      // exists (a common source of accidental duplicate SKUs from misreads).
      const barcodeExists = inventory.some((i) => i.barcode === scannedItem.barcode);
      if (!barcodeExists) {
        const trimmedName = normalizeName(itemName);
        const similar = inventory.find(
          (i) => normalizeName(i.name) === trimmedName && i.barcode !== scannedItem.barcode
        );
        if (similar) {
          const proceed = await dialog.confirm({
            title: 'Similar product exists',
            message: `"${similar.name}" already exists with a different barcode (${similar.barcode}). Add this as a separate product?`,
            confirmText: 'Add anyway',
            cancelText: 'Cancel',
          });
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }

      const itemToAdd: Item = {
        ...scannedItem,
        name: itemName.trim(),
        price: priceNum,
        quantity: quantityNum,
        category: selectedCategory,
        imageUri: savedImageUri,
      };

      if (wasRemoved) {
        await removeFromRemovedBarcodes(scannedItem.barcode);
        inventory.push(itemToAdd);
        await storageService.saveInventory(inventory);
        toast.showToast({ message: 'Product added', variant: 'success' });
      } else {
        const existingItemIndex = inventory.findIndex((i) => i.barcode === itemToAdd.barcode);
        if (existingItemIndex !== -1) {
          inventory[existingItemIndex] = {
            ...inventory[existingItemIndex],
            name: itemToAdd.name,
            quantity: inventory[existingItemIndex].quantity + itemToAdd.quantity,
            price: itemToAdd.price,
            category: itemToAdd.category,
          };
          if (savedImageUri) {
            inventory[existingItemIndex].imageUri = savedImageUri;
          }
          await storageService.saveInventory(inventory);
          toast.showToast({ message: 'Product quantity updated', variant: 'success' });
        } else {
          inventory.push(itemToAdd);
          await storageService.saveInventory(inventory);
          toast.showToast({ message: 'Product added', variant: 'success' });
        }
      }

      resetForm();
    } catch (error) {
      console.error('Error saving item:', error);
      void dialog.alert({ title: 'Save failed', message: 'Failed to add product to inventory.' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setScannedItem(null);
    setScanned(false);
    processingRef.current = false;
    setProductImage(null);
    setExistingProduct(false);
    setItemName('');
    setPrice('');
    setQuantity('1');
    setSelectedCategory('');
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={styles.permissionText}>Requesting camera permission…</Text>
      </View>
    );
  }

  const scanningActive = !scanned && !showBarcodeInput;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        {!scanned ? (
          <View style={styles.scanContainer}>
            <Text style={styles.scanHint}>Point the camera at the product barcode</Text>

            <View style={styles.cameraFrame}>
              {hasPermission ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  active={scanningActive}
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                  }}
                  onBarcodeScanned={scanningActive ? handleBarCodeScanned : undefined}
                />
              ) : (
                <View style={styles.noCamera}>
                  <Ionicons name="camera-outline" size={40} color={theme.textSecondary} />
                  <Text style={styles.permissionText}>Camera unavailable</Text>
                </View>
              )}
              <View style={styles.reticle} pointerEvents="none" />
            </View>

            <TouchableOpacity
              style={[styles.manualButton, { marginBottom: Math.max(insets.bottom, 12) + 8 }]}
              onPress={() => setShowBarcodeInput(true)}
            >
              <Ionicons name="keypad-outline" size={18} color={theme.primary} />
              <Text style={styles.manualButtonText}>Enter barcode manually</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={[styles.formContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            {scannedItem && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Product information</Text>
                  <Text style={styles.barcodeText}>Barcode: {scannedItem.barcode}</Text>
                </View>

                {existingProduct && (
                  <View style={styles.existingProductBanner}>
                    <Ionicons name="information-circle" size={20} color="#ffffff" />
                    <Text style={styles.existingProductText}>Existing product — quantity will be added</Text>
                  </View>
                )}

                <View style={styles.imageSection}>
                  <TouchableOpacity style={styles.imageButton} onPress={pickProductImage} onLongPress={captureProductImage}>
                    {productImage ? (
                      <Image source={{ uri: productImage }} style={styles.productImage} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <FontAwesome5 name="camera" size={28} color={theme.textSecondary} />
                        <Text style={styles.imagePlaceholderText}>{existingProduct ? 'Update image' : 'Add image'}</Text>
                        <Text style={styles.imagePlaceholderHint}>Tap to choose · hold to shoot</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Product name *</Text>
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
                    <Text style={styles.label}>Price (Rs.) *</Text>
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
                      {categories.map((category) => (
                        <TouchableOpacity
                          key={category}
                          style={[styles.categoryButton, selectedCategory === category && styles.selectedCategoryButton]}
                          onPress={() => setSelectedCategory(category)}
                        >
                          <Text
                            style={[
                              styles.categoryButtonText,
                              selectedCategory === category && styles.selectedCategoryButtonText,
                            ]}
                          >
                            {category}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.buttonGroup}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
                    <Text style={styles.secondaryButtonText}>Scan again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButton} onPress={addItemToInventory} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>{existingProduct ? 'Update inventory' : 'Add to inventory'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <BarcodeInputModal
        visible={showBarcodeInput}
        onClose={() => setShowBarcodeInput(false)}
        onSubmit={(barcode) => {
          setShowBarcodeInput(false);
          setScanned(true);
          processingRef.current = true;
          void processScannedBarcode(barcode);
        }}
        theme={theme}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: theme.background,
    },
    permissionText: { color: theme.textSecondary, marginTop: 12, fontSize: 15 },
    keyboardAvoidingContainer: { flex: 1 },
    scanContainer: { flex: 1, alignItems: 'center', paddingTop: 24, paddingHorizontal: 20 },
    scanHint: { color: theme.textSecondary, fontSize: 14, marginBottom: 16, textAlign: 'center' },
    cameraFrame: {
      width: '86%',
      aspectRatio: 1,
      maxWidth: 320,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
    noCamera: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    reticle: {
      position: 'absolute',
      top: '18%',
      left: '12%',
      right: '12%',
      bottom: '18%',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.85)',
      borderRadius: 12,
    },
    manualButton: {
      marginTop: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.cardBackground,
    },
    manualButtonText: { color: theme.primary, fontSize: 15, fontWeight: '800' },
    formContainer: { flex: 1 },
    formContent: { padding: 20 },
    sectionHeader: { marginBottom: 18 },
    sectionHeaderText: { fontSize: 17, fontWeight: 'bold', color: theme.text },
    barcodeText: { fontSize: 14, color: theme.textSecondary, marginTop: 4 },
    existingProductBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.mode === 'dark' ? '#78350f' : '#f59e0b',
      padding: 10,
      borderRadius: 8,
      marginBottom: 18,
      gap: 8,
    },
    existingProductText: { color: '#ffffff', fontSize: 13, flex: 1 },
    imageSection: { alignItems: 'center', marginBottom: 20 },
    imageButton: {
      width: 160,
      height: 160,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: 'hidden',
    },
    productImage: { width: '100%', height: '100%' },
    imagePlaceholder: { justifyContent: 'center', alignItems: 'center', padding: 16 },
    imagePlaceholderText: { marginTop: 10, color: theme.text, fontWeight: '700', textAlign: 'center' },
    imagePlaceholderHint: { marginTop: 4, color: theme.textSecondary, fontSize: 12, textAlign: 'center' },
    formGroup: { marginBottom: 18 },
    label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: theme.text },
    input: {
      backgroundColor: theme.cardBackground,
      padding: 14,
      borderRadius: 8,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    halfWidth: { width: '48%' },
    categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 8 },
    categoryButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    selectedCategoryButton: { backgroundColor: theme.primary, borderColor: theme.primary },
    categoryButtonText: { color: theme.text },
    selectedCategoryButtonText: { color: '#ffffff' },
    buttonGroup: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12 },
    primaryButton: {
      flex: 1,
      backgroundColor: theme.primary,
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
    },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    secondaryButton: {
      flex: 1,
      backgroundColor: theme.cardBackground,
      padding: 15,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.divider,
    },
    secondaryButtonText: { color: theme.text, fontSize: 16, fontWeight: 'bold' },
  });

export default AddItemScreen;
