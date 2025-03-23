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
  
  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(cameraStatus === 'granted');
      
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    })();

    return () => {
      // Cleanup
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

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;
    
    setScanned(true);
    const { data, type } = result;
    
    console.log(`Barcode with type ${type} and data ${data} has been scanned!`);

}

  const captureProductImage = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
    } catch (error) {
      console.error('Error capturing image:', error);
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const addItemToInventory = async () => {
    if (!scannedItem) return;
    
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
      const wasRemoved = await checkRemovedBarcode(scannedItem.barcode);
      
      let savedImageUri = undefined;
      if (productImage) {
        savedImageUri = await saveImageToStorage(scannedItem.barcode, productImage);
      }
      
      const inventoryJSON = await AsyncStorage.getItem('inventory');
      let inventory: Item[] = inventoryJSON ? JSON.parse(inventoryJSON) : [];
      
      const itemToAdd: Item = {
        ...scannedItem,
        name: itemName.trim(),
        quantity: quantityNum,
        price: priceNum,
        imageUri: savedImageUri
      };
      
      if (wasRemoved) {
        await removeFromRemovedBarcodes(scannedItem.barcode);
        
        inventory.push(itemToAdd);
        
        await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
        Alert.alert('Success', 'Item added to inventory as new product');
      } else {
        const existingItemIndex = inventory.findIndex(i => i.barcode === itemToAdd.barcode);
        
        if (existingItemIndex !== -1) {
          inventory[existingItemIndex] = {
            ...inventory[existingItemIndex],
            name: itemToAdd.name,
            quantity: inventory[existingItemIndex].quantity + itemToAdd.quantity,
            price: itemToAdd.price,
          };
          
          if (savedImageUri) {
            inventory[existingItemIndex].imageUri = savedImageUri;
          }
          
          await AsyncStorage.setItem('inventory', JSON.stringify(inventory));
          Alert.alert('Success', 'Item quantity updated in inventory');
        } else {
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
});

export default AddItemScreen;