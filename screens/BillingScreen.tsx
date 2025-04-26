// BillingScreen.tsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { CameraView, BarcodeScanningResult, Camera } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import { Audio } from 'expo-av';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../src/contexts/ThemeContext';
import { RootStackParamList } from '../App';
import BarcodeInputModal from '../src/components/BarcodeInputModal';
import PaymentMethodSelector from '../src/components/PaymentMethodSelector';

interface BillItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  image?: string;
}

interface Bill {
  id: string;
  items: BillItem[];
  total: number;
  customerName: string;
  timestamp: number;
  paymentMethod: string;
}

const BillingScreen: React.FC<{ navigation: StackNavigationProp<RootStackParamList, 'Billing'> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const setup = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
        await loadInventory();
        await loadSound();
      } catch (error) {
        console.error('Error initializing:', error);
        setHasPermission(false);
      }
    };

    setup();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadInventory = async () => {
    try {
      const inventoryJSON = await AsyncStorage.getItem('inventory');
      if (inventoryJSON) {
        setInventory(JSON.parse(inventoryJSON));
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory');
    }
  };

  const loadSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/BEEP_SOUND.mp3')
      );
      soundRef.current = sound;
    } catch (error) {
      console.error('Failed to load sound', error);
    }
  };

  const playSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.replayAsync();
      } catch (error) {
        console.error('Failed to play sound', error);
      }
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    const { data } = result;
    await playSound();
    
    const item = inventory.find(i => i.barcode === data);
    if (item) {
      if (item.quantity <= 0) {
        Alert.alert('Out of Stock', `${item.name} is out of stock`);
        return;
      }
      addItemToBill(item);
    } else {
      Alert.alert('Not Found', 'Item not found in inventory');
    }
    setScanning(false);
  };

  const addItemToBill = (item: any) => {
    setBillItems(prevItems => {
      const existingItem = prevItems.find(i => i.id === item.barcode);
      const inventoryItem = inventory.find(i => i.barcode === item.barcode);
      
      if (existingItem) {
        // Check if adding one more would exceed stock
        if (existingItem.quantity + 1 > (inventoryItem?.quantity || 0)) {
          Alert.alert('Out of Stock', `Only ${inventoryItem?.quantity} units available`);
          return prevItems;
        }
        return prevItems.map(i => 
          i.id === item.barcode 
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.price }
            : i
        );
      } else {
        // For new item, check if at least 1 is available
        if (item.quantity <= 0) {
          Alert.alert('Out of Stock', 'This item is out of stock');
          return prevItems;
        }
        return [
          ...prevItems,
          {
            id: item.barcode,
            name: item.name,
            quantity: 1,
            price: item.price,
            total: item.price,
            image: item.imageUri
          }
        ];
      }
    });
  };

  const removeItem = (id: string) => {
    setBillItems(prevItems => prevItems.filter(item => item.id !== id));
  };

const updateQuantity = (id: string, newQuantity: number) => {
  if (newQuantity <= 0) {
    removeItem(id);
    return;
  }

  const inventoryItem = inventory.find(i => i.barcode === id);
  if (inventoryItem && newQuantity > inventoryItem.quantity) {
    Alert.alert('Out of Stock', `Only ${inventoryItem.quantity} units available`);
    return;
  }

  setBillItems(prevItems =>
    prevItems.map(item =>
      item.id === id
        ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
        : item
    )
  );
};

  const calculateTotal = () => {
    return billItems.reduce((sum, item) => sum + item.total, 0);
  };

  const processPayment = async () => {
    if (billItems.length === 0) {
      Alert.alert('Error', 'No items in the bill');
      return;
    }

    setLoading(true);
    try {
      const billId = `BILL-${Date.now()}`;
      const bill: Bill = {
        id: billId,
        items: billItems,
        total: calculateTotal(),
        customerName,
        timestamp: Date.now(),
        paymentMethod
      };

      const updatedInventory = inventory.map(item => {
        const billItem = billItems.find(bi => bi.id === item.barcode);
        if (billItem) {
          return { ...item, quantity: item.quantity - billItem.quantity };
        }
        return item;
      });

      await AsyncStorage.setItem('inventory', JSON.stringify(updatedInventory));
      
      const billsJSON = await AsyncStorage.getItem('bills');
      const bills = billsJSON ? JSON.parse(billsJSON) : [];
      await AsyncStorage.setItem('bills', JSON.stringify([...bills, bill]));

      setBillItems([]);
      setCustomerName('');
      setPaymentMethod('Cash');
      setShowPaymentModal(false);
      
      navigation.navigate('BillReceipt', { billId });
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const renderBillItem = ({ item }: { item: BillItem }) => {
    const inventoryItem = inventory.find(i => i.barcode === item.id);
    const availableStock = inventoryItem?.quantity || 0;
    const isMaxQuantity = item.quantity >= availableStock;
  
    return (
      <View style={styles.billItem}>
        <View style={styles.itemImageContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.itemImage} />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <FontAwesome5 name="box" size={20} color={theme.textSecondary} />
            </View>
          )}
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
          <Text style={styles.stockText}>
            {availableStock > 0 ? `${availableStock} in stock` : 'Out of stock'}
          </Text>
        </View>
        
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          
          <View style={styles.quantityDisplay}>
            <Text style={styles.quantityText}>{item.quantity}</Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.quantityButton,
              isMaxQuantity && styles.disabledButton
            ]}
            onPress={() => {
              if (!isMaxQuantity) {
                updateQuantity(item.id, item.quantity + 1);
              }
            }}
            disabled={isMaxQuantity}
          >
            <Text style={[
              styles.quantityButtonText,
              isMaxQuantity && styles.disabledButtonText
            ]}>+</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.itemTotal}>${item.total.toFixed(2)}</Text>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeItem(item.id)}
        >
          <MaterialIcons name="delete" size={24} color="#dc3545" />
        </TouchableOpacity>
      </View>
    );
  };
  const filteredInventory = useMemo(() => {
    return inventory.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.barcode.includes(searchQuery)
    );
  }, [inventory, searchQuery]);

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access denied</Text>
        <Text style={styles.permissionSubtext}>You can still add items manually</Text>
        
        <TouchableOpacity
          style={styles.button}
          onPress={() => setShowItemsModal(true)}
        >
          <Text style={styles.buttonText}>Browse Items</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.manualButton]}
          onPress={() => setShowManualInput(true)}
        >
          <Text style={styles.buttonText}>Enter Barcode</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {scanning ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "upc_a", "code128"]
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.cameraButtonsContainer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setScanning(false)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.manualInputButton}
              onPress={() => {
                setScanning(false);
                setShowManualInput(true);
              }}
            >
              <Text style={styles.manualInputButtonText}>Manual Input</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerText}>Current Bill</Text>
            <Text style={styles.itemCount}>{billItems.length} items</Text>
          </View>

          <FlatList
            data={billItems}
            renderItem={renderBillItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.billList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="receipt" size={48} color={theme.textSecondary} />
                <Text style={styles.emptyText}>No items added</Text>
                <Text style={styles.emptySubtext}>Scan items to start billing</Text>
              </View>
            }
          />

          <View style={styles.footer}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>${calculateTotal().toFixed(2)}</Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={() => setShowItemsModal(true)}
              >
                <FontAwesome5 name="list" size={20} color={theme.primary} />
                <Text style={[styles.buttonText, { color: theme.primary }]}>Items</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.scanButton]}
                onPress={() => setScanning(true)}
              >
                <FontAwesome5 name="barcode" size={20} color="white" />
                <Text style={styles.buttonText}>Scan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={() => setShowPaymentModal(true)}
                disabled={billItems.length === 0}
              >
                <FontAwesome5 name="money-bill-wave" size={20} color="white" />
                <Text style={styles.buttonText}>Pay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Customer Name (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer name"
              placeholderTextColor={theme.placeholder}
            />

            <Text style={styles.modalLabel}>Payment Method</Text>
            <PaymentMethodSelector
              selectedMethod={paymentMethod}
              onSelectMethod={setPaymentMethod}
              theme={theme}
            />

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryLabel}>Items: {billItems.length}</Text>
              <Text style={styles.summaryLabel}>Total:</Text>
              <Text style={styles.summaryTotal}>${calculateTotal().toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={processPayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.modalButtonText}>
                  Confirm Payment ({paymentMethod})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Items Modal */}
      <Modal
        visible={showItemsModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.itemsModalContainer}>
          <View style={styles.itemsModalContent}>
            <View style={styles.itemsModalHeader}>
              <Text style={styles.itemsModalTitle}>Available Items</Text>
              <TouchableOpacity onPress={() => setShowItemsModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search items..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.placeholder}
            />

            <FlatList
              data={filteredInventory}
              keyExtractor={item => item.barcode}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.inventoryItem}
                  onPress={() => {
                    addItemToBill(item);
                    setShowItemsModal(false);
                  }}
                >
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.inventoryImage} />
                  ) : (
                    <View style={styles.inventoryImagePlaceholder}>
                      <FontAwesome5 name="box" size={20} color={theme.textSecondary} />
                    </View>
                  )}
                  <View style={styles.inventoryDetails}>
                    <Text style={styles.inventoryName}>{item.name}</Text>
                    <Text style={styles.inventoryPrice}>${item.price.toFixed(2)}</Text>
                    <Text style={styles.inventoryStock}>Stock: {item.quantity}</Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.inventoryList}
            />
          </View>
        </View>
      </Modal>

      {/* Manual Barcode Input Modal */}
      <BarcodeInputModal
        visible={showManualInput}
        onClose={() => setShowManualInput(false)}
        onSubmit={(barcode) => {
          const item = inventory.find(i => i.barcode === barcode);
          if (item) {
            playSound();
            addItemToBill(item);
          } else {
            Alert.alert('Not Found', 'Item not found in inventory');
          }
          setShowManualInput(false);
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
  permissionText: {
    fontSize: 18,
    color: theme.text,
    marginBottom: 10,
  },
  permissionSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 20,
  },
  button: {
    backgroundColor: theme.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '80%',
  },
  manualButton: {
    backgroundColor: theme.secondary,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraButtonsContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualInputButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualInputButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  itemCount: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  billList: {
    padding: 10,
    flexGrow: 1,
  },
  billItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
  },
  itemImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: theme.inputBackground,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  quantityText: {
    marginHorizontal: 10,
    fontSize: 16,
    color: theme.text,
  },
  itemTotal: {
    width: 70,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  stockText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  quantityDisplay: {
    minWidth: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: theme.disabled,
  },
  disabledButtonText: {
    color: theme.textSecondary,
  },
  deleteButton: {
    marginLeft: 10,
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
  footer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 18,
    color: theme.text,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  secondaryButton: {
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  scanButton: {
    backgroundColor: '#4a89dc',
  },
  primaryButton: {
    backgroundColor: theme.primary,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: theme.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
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
  modalLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    color: theme.text,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  summaryLabel: {
    fontSize: 16,
    color: theme.text,
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primary,
  },
  modalButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  itemsModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  itemsModalContent: {
    flex: 1,
    marginTop: 50,
    backgroundColor: theme.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  itemsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  itemsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  searchInput: {
    backgroundColor: theme.inputBackground,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    color: theme.text,
  },
  inventoryList: {
    paddingBottom: 20,
  },
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    backgroundColor: theme.inputBackground,
    borderRadius: 8,
  },
  inventoryImage: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 15,
  },
  inventoryImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: theme.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  inventoryDetails: {
    flex: 1,
  },
  inventoryName: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 5,
  },
  inventoryPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.primary,
  },
  inventoryStock: {
    fontSize: 12,
    color: theme.textSecondary,
  },
});

export default BillingScreen;