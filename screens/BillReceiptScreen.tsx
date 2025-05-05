// BillReceiptScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Share,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { Bill, BillItem } from '../src/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../App';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';


interface BillReceiptScreenProps {
  navigation: StackNavigationProp<RootStackParamList, 'BillReceipt'>;
  route: RouteProp<RootStackParamList, 'BillReceipt'>;
}



const BillReceiptScreen: React.FC<BillReceiptScreenProps> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [bill, setBill] = React.useState<Bill | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchBill = async () => {
      try {
        const billsJSON = await AsyncStorage.getItem('bills');
        if (billsJSON) {
          const bills: Bill[] = JSON.parse(billsJSON);
          const foundBill = bills.find(b => b.id === route.params.billId);
          if (foundBill) {
            setBill(foundBill);
          }
        }
      } catch (error) {
        console.error('Error fetching bill:', error);
        Alert.alert('Error', 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [route.params.billId]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const shareReceipt = async () => {
    if (!bill) return;

    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .title { font-size: 24px; font-weight: bold; }
              .date { font-size: 14px; color: #666; }
              .divider { border-top: 1px dashed #000; margin: 15px 0; }
              .item-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
              .total-row { font-weight: bold; margin-top: 10px; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Invoice</div>
              <div class="date">${formatDate(bill.timestamp)}</div>
            </div>
            <div>Customer: ${bill.customerName || 'Walk-in'}</div>
            <div>Payment: ${bill.paymentMethod}</div>
            <div class="divider"></div>
            ${bill.items.map(item => `
              <div class="item-row">
                <div>${item.quantity} x ${item.name}</div>
                <div>$${item.total.toFixed(2)}</div>
              </div>
            `).join('')}
            <div class="divider"></div>
            <div class="item-row total-row">
              <div>TOTAL</div>
              <div>$${bill.total.toFixed(2)}</div>
            </div>
            <div class="footer">Thank you for your purchase!</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      if (Platform.OS === 'android') {
        await Sharing.shareAsync(uri);
      } else {
        await Share.share({
          url: uri,
          title: 'Invoice Receipt'
        });
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Receipt not found</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Back to Billing</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Receipt</Text>
          <Text style={styles.receiptId}>#{bill.id}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date:</Text>
          <Text style={styles.infoValue}>{formatDate(bill.timestamp)}</Text>
        </View>

        {bill.customerName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer:</Text>
            <Text style={styles.infoValue}>{bill.customerName}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payment Method:</Text>
          <Text style={styles.infoValue}>{bill.paymentMethod}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemsHeader}>
          <Text style={styles.itemsHeaderText}>ITEMS</Text>
          <Text style={styles.itemsHeaderText}>TOTAL</Text>
        </View>

        {bill.items.map((item, index) => (
          <View key={`${item.id}-${index}`} style={styles.itemRow}>
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>
                {item.quantity} x {item.name}
              </Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)} each</Text>
            </View>
            <Text style={styles.itemTotal}>${item.total.toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalAmount}>${bill.total.toFixed(2)}</Text>
        </View>

        <View style={styles.thankYouContainer}>
          <Text style={styles.thankYouText}>Thank you for your purchase!</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Billing')}
        >
          <FontAwesome5 name="receipt" size={20} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>
            New Bill
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={shareReceipt}
        >
          <Ionicons name="share-social" size={20} color="white" />
          <Text style={styles.actionButtonText}>Share Receipt</Text>
        </TouchableOpacity>
      </View>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: theme.text,
    marginBottom: 20,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  receiptId: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.divider,
    marginVertical: 15,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  itemsHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 3,
  },
  itemPrice: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primary,
  },
  thankYouContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: 16,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  shareButton: {
    backgroundColor: theme.primary,
    borderWidth: 0,
  },
  actionButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
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

export default BillReceiptScreen;