import React, { useState } from 'react';
import { View, Text, StyleSheet , Modal, Image, ScrollView } from 'react-native';
import { CameraView } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Dashboard: undefined;
  Billing: undefined;
  BillReceipt: { billId: string };
};

const BillingScreen: React.FC<BillingScreenProps> = ({ navigation }) => {
  const [scanning, setScanning] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showItemsGallery, setShowItemsGallery] = useState(false);



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