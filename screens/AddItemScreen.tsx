import React, { useState, useEffect, useRef } from 'react';
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
  Image
} from 'react-native';
import { CameraView, BarcodeScanningResult, Camera } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

type RootStackParamList = {
  Dashboard: undefined;
  AddItem: undefined;
};

type AddItemScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'AddItem'>;
};

interface Item {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  imageUri?: string;
}

const AddItemScreen: React.FC<AddItemScreenProps> = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scannedItem, setScannedItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [productImage, setProductImage] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [existingProduct, setExistingProduct] = useState(false);
  
  useEffect(() => {
    (async () => {
      // Request camera permission
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(cameraStatus === 'granted');
      
      // Request camera roll permission
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      // Load sound
      loadSound();
      
      // Create product images directory if it doesn't exist
      await ensureDirectoryExists();
    })();

    return () => {
      // Clean up sound when component unmounts
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

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
      setSound(sound);
    } catch (error) {
      console.error('Error loading sound:', error);
    }
  };

  const playSound = async () => {
    try {
      if (sound) {
        await sound.replayAsync();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  // Check if a barcode was previously removed
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

  // Remove a barcode from the removed list (when adding back)
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

  // Check if the item exists in inventory and return it
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
    
    // Play beep sound
    await playSound();
    
    // Reset state
    setExistingProduct(false);
    
    // Check if barcode was previously removed
    const wasRemoved = await checkRemovedBarcode(data);
    
    // Check if this item exists in inventory (and wasn't previously removed)
    if (!wasRemoved) {
      const existingItem = await findExistingItem(data);
      
      if (existingItem) {
        // Auto-fill fields from existing item
        setItemName(existingItem.name);
        setPrice(existingItem.price.toString());
        setQuantity('1'); // Default to 1 for incrementing
        setExistingProduct(true);
        
        Alert.alert(
          'Product Found',
          `"${existingItem.name}" already exists in inventory with ${existingItem.quantity} units. The details have been filled in.`,
          [{ text: 'OK' }]
        );
      } else {
        // New product
        setItemName('');
        setPrice('');
        setQuantity('1');
      }
    } else {
      // Previously removed product is treated as new
      setItemName('');
      setPrice('');
      setQuantity('1');
    }
    
    // Create initial item object
    const scanResult: Item = {
      barcode: data,
      name: '',
      quantity: 1,
      price: 0,
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
        quality: 0.8, // Lower initial quality to reduce processing needed
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
  
  const compressImage = async (uri: string): Promise<string> => {
    try {
      // Use the ImageManipulator methods to process the image
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 500 } }], // Resize to width of 500px
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      return result.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri; // Return original URI if compression fails
    }
  };

  const saveImageToStorage = async (barcode: string, imageUri: string): Promise<string> => {
    try {
      // Create a unique filename based on barcode
      const fileName = `product_${barcode}.jpg`;
      const directory = await ensureDirectoryExists();
      
      // Create the full destination path
      const newUri = directory + fileName;
      
      // Check if a previous image exists and delete it
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(newUri, { idempotent: true });
        console.log('Deleted previous image:', newUri);
      }
      
      // Copy the new image
      await FileSystem.copyAsync({
        from: imageUri,
        to: newUri
      });
      
      console.log('Image saved successfully to:', newUri);
      
      return newUri;
    } catch (error) {
      console.error('Error saving image:', error);
      return imageUri; // Return original URI if save fails
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
        quantity: quantityNum,
        price: priceNum,
        imageUri: savedImageUri
      };
      
      // If the barcode was previously removed, we need to remove it from the removed list
      if (wasRemoved) {
        await removeFromRemovedBarcodes(scannedItem.barcode);
        
        // For previously removed items, add as new
        inventory.push(itemToAdd);
        
        await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
        Alert.alert('Success', 'Item added to inventory as new product');
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
          };
          
          // Only update image if a new one was provided
          if (savedImageUri) {
            inventory[existingItemIndex].imageUri = savedImageUri;
          }
          
          await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
          Alert.alert('Success', 'Item quantity updated in inventory');
        } else {
          // Add new item
          inventory.push(itemToAdd);
          await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
          Alert.alert('Success', 'New item added to inventory');
        }
      }
      
      setScannedItem(null);
      setScanned(false);
      setProductImage(null);
      setExistingProduct(false);
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'Failed to add item to inventory');
    }
  };

  const cancelScanning = () => {
    setScannedItem(null);
    setScanned(false);
    setProductImage(null);
    setExistingProduct(false);
  };

  if (hasPermission === null) {
    return <Text>Requesting camera permission...</Text>;
  }
  
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingContainer} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.cameraContainer}>
          {!scanned ? (
            <>
              <Text style={styles.headerText}>Scan a Barcode or QR Code</Text>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: [
                    "qr", 
                    "ean13", 
                    "ean8", 
                    "upc_e", 
                    "code39", 
                    "code128", 
                    "itf14",
                    "codabar",
                    "upc_a"
                  ],
                }}
                onBarcodeScanned={handleBarCodeScanned}
              />
            </>
          ) : (
            <View style={styles.scannedItemContainer}>
              {scannedItem && (
                <>
                  <Text style={styles.itemTitle}>Product Details</Text>
                  <Text style={styles.itemText}>Barcode: {scannedItem.barcode}</Text>
                  
                  {existingProduct && (
                    <Text style={styles.existingProductText}>
                      Existing product - update quantity
                    </Text>
                  )}
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Name:</Text>
                    <TextInput
                      style={styles.input}
                      value={itemName}
                      onChangeText={setItemName}
                      placeholder="Enter product name"
                    />
                  </View>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Quantity:</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="number-pad"
                      placeholder="Enter quantity"
                    />
                  </View>
                  
                  {/* Image preview section */}
                  <View style={styles.imageSection}>
                    <TouchableOpacity 
                      style={styles.imageButton}
                      onPress={captureProductImage}
                    >
                      <Text style={styles.imageButtonText}>
                        {productImage ? 'Retake Photo' : existingProduct ? 'Update Product Photo (Optional)' : 'Take Product Photo (Optional)'}
                      </Text>
                    </TouchableOpacity>
                    
                    {productImage && (
                      <Image 
                        source={{ uri: productImage }} 
                        style={styles.productImage} 
                      />
                    )}
                  </View>
                  
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={addItemToInventory}
                    >
                      <Text style={styles.buttonText}>
                        {existingProduct ? 'Update Inventory' : 'Add to Inventory'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={cancelScanning}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={[styles.scanButton, !scanned ? styles.buttonDisabled : null]}
          onPress={() => {
            setScanned(false);
            setExistingProduct(false);
          }}
          disabled={!scanned}
        >
          <Text style={styles.buttonText}>Scan Again</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    position: 'absolute',
    top: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scannedItemContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  itemTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  itemText: {
    fontSize: 18,
    marginBottom: 10,
  },
  existingProductText: {
    fontSize: 16,
    color: '#4a89dc',
    fontWeight: 'bold',
    marginBottom: 15,
    backgroundColor: '#e0f0ff',
    padding: 8,
    borderRadius: 6,
    width: '100%',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
  },
  inputLabel: {
    fontSize: 18,
    width: 100,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  imageSection: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 15,
  },
  imageButton: {
    backgroundColor: '#9370DB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
    alignItems: 'center',
  },
  imageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  productImage: {
    width: 150,
    height: 150,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 10,
  },
  buttonContainer: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  scanButton: {
    backgroundColor: '#4a89dc',
    padding: 15,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#dc4a4a',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#a0a0a0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddItemScreen;