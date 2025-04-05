import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList, Alert, TextInput, Modal, Image, ScrollView } from 'react-native';
import { CameraView } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Dashboard: undefined;
  Billing: undefined;
  BillReceipt: { billId: string };
};

type BillingScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Billing'>;
};

interface Item {
  barcode: string;
  name: string;
  quantity: number;
  price: number;
  image?: string; // URL or local path to image
}

interface ItemGroup {
  name: string;
  barcodes: string[];
  quantity: number;
  price: number;
  image?: string; // URL or local path to image
}

interface BillItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  image?: string; // URL or local path to image
}

interface Bill {
  id: string;
  items: BillItem[];
  total: number;
  customerName: string;
  timestamp: number;
  paymentMethod: string;
}

const BillingScreen: React.FC<BillingScreenProps> = ({ navigation }) => {
  const [scanning, setScanning] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showItemsGallery, setShowItemsGallery] = useState(false);


  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      // Load inventory data
      loadInventory();
      
      // Load sound
      await loadSound();
    })();

    return () => {
      // Unload sound when component unmounts
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  const loadSound = async () => {
    try {
      const { sound: scanSound } = await Audio.Sound.createAsync(
        require('../assets/BEEP_SOUND.mp3')
      );
      sound.current = scanSound;
    } catch (error) {
      console.error('Failed to load sound', error);
    }
  };

  const playSound = async () => {
    if (sound.current) {
      try {
        await sound.current.setPositionAsync(0); // Reset sound to beginning
        await sound.current.playAsync();
      } catch (error) {
        console.error('Failed to play sound', error);
      }
    }
  };
  const loadInventory = async () => {
    try {
      const inventoryJSON = await AsyncStorage.getItem('inventory');
      const groupedInventoryJSON = await AsyncStorage.getItem('groupedInventory');
      
      if (inventoryJSON) {
        const loadedInventory = JSON.parse(inventoryJSON);
        setInventory(loadedInventory);
        setFilteredItems(loadedInventory);
      }
      
      if (groupedInventoryJSON) {
        setGroupedInventory(JSON.parse(groupedInventoryJSON));
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory');
    }
  };

  useEffect(() => {
    const allItems = [...inventory, ...groupedInventory];
    
    if (searchQuery.trim() === '') {
      setFilteredItems(allItems);
    } else {
      const filtered = allItems.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, inventory, groupedInventory]);


  return (
    <SafeAreaView style={styles.container}>
      {scanning ? (
        <View style={styles.cameraContainer}>
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
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setScanning(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : showItemsGallery ? (
        <View style={styles.galleryContainer}>
          <View style={styles.galleryHeader}>
            <Text style={styles.galleryTitle}>Available Items</Text>
            <TouchableOpacity
              style={styles.closeGalleryButton}
              onPress={() => setShowItemsGallery(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          
          <FlatList
            data={filteredItems}
            renderItem={renderInventoryItem}
            keyExtractor={item => 'barcode' in item ? item.barcode : `group-${item.name}`}
            numColumns={2}
            contentContainerStyle={styles.galleryList}
          />
        </View>
      ) : (
        <>
          <View style={styles.billHeader}>
            <View style={styles.billHeaderRow}>
              <Text style={[styles.billHeaderItem, { flex: 2 }]}>Item</Text>
              <Text style={styles.billHeaderItem}>Qty</Text>
              <Text style={[styles.billHeaderItem, { flex: 1 }]}>Price</Text>
              <Text style={[styles.billHeaderItem, { width: 40 }]}></Text>
            </View>
          </View>
          
          <FlatList
            data={billItems}
            renderItem={renderBillItem}
            keyExtractor={item => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>No items in bill</Text>}
          />
          
          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>Total: ${calculateTotal().toFixed(2)}</Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={() => setShowItemsGallery(true)}
            >
              <Text style={styles.buttonText}>View Items</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.scanButton}
              onPress={() => {
                setScanned(false);
                setScanning(true);
              }}
            >
              <Text style={styles.buttonText}>Scan Barcode</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.generateButton}
              onPress={generateBill}
              disabled={billItems.length === 0}
            >
              <Text style={styles.buttonText}>Generate Bill</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      
      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Complete Purchase</Text>
            
            <Text style={styles.modalLabel}>Customer Name (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer name"
            />
        
            

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
});

export default BillingScreen;