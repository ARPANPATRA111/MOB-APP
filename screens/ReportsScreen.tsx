// ReportsScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import { useTheme } from '../src/contexts/ThemeContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

// Define interfaces
interface ReportItem {
  id: string;
  name: string;
  quantity: number;
  totalSales: number;
}

interface SalesReport {
  period: string;
  totalSales: number;
  totalItems: number;
  items: ReportItem[];
}

interface Bill {
  id: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  total: number;
  customerName: string;
  timestamp: number;
  paymentMethod: string;
}

type ReportsScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Reports'>;
};

const periodOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const ReportsScreen: React.FC<ReportsScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<SalesReport | null>(null);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [customDate, setCustomDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [period, customDate]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const billsJSON = await AsyncStorage.getItem('bills');
      if (!billsJSON) {
        setReports(null);
        return;
      }

      const allBills: Bill[] = JSON.parse(billsJSON);
      const filteredBills = filterBillsByPeriod(allBills, period, customDate);
      const report = generateSalesReport(filteredBills);
      
      setReports(report);
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load sales reports');
    } finally {
      setLoading(false);
    }
  };

  const filterBillsByPeriod = (bills: Bill[], period: string, date: Date): Bill[] => {
    const targetDate = new Date(date);
    
    return bills.filter(bill => {
      const billDate = new Date(bill.timestamp);
      
      switch (period) {
        case 'daily':
          return (
            billDate.getDate() === targetDate.getDate() &&
            billDate.getMonth() === targetDate.getMonth() &&
            billDate.getFullYear() === targetDate.getFullYear()
          );
        case 'weekly':
          const weekStart = new Date(targetDate);
          weekStart.setDate(targetDate.getDate() - targetDate.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          return billDate >= weekStart && billDate <= weekEnd;
        case 'monthly':
          return (
            billDate.getMonth() === targetDate.getMonth() &&
            billDate.getFullYear() === targetDate.getFullYear()
          );
        case 'yearly':
          return billDate.getFullYear() === targetDate.getFullYear();
        default:
          return true;
      }
    });
  };

  const generateSalesReport = (bills: Bill[]): SalesReport => {
    const itemsMap = new Map<string, ReportItem>();
    let totalSales = 0;
    let totalItems = 0;

    bills.forEach(bill => {
      totalSales += bill.total;
      bill.items.forEach(item => {
        totalItems += item.quantity;
        const existingItem = itemsMap.get(item.id);
        
        if (existingItem) {
          existingItem.quantity += item.quantity;
          existingItem.totalSales += item.total;
        } else {
          itemsMap.set(item.id, {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            totalSales: item.total
          });
        }
      });
    });

    return {
      period: getPeriodLabel(period, customDate),
      totalSales,
      totalItems,
      items: Array.from(itemsMap.values()).sort((a, b) => b.totalSales - a.totalSales)
    };
  };

  const getPeriodLabel = (period: string, date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    switch (period) {
      case 'daily':
        return date.toLocaleDateString(undefined, options);
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - 
                ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'monthly':
        return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      case 'yearly':
        return date.toLocaleDateString(undefined, { year: 'numeric' });
      default:
        return '';
    }
  };

  const generatePDF = async () => {
    if (!reports) return;

    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .title { font-size: 24px; font-weight: bold; }
              .period { font-size: 16px; color: #666; margin-bottom: 10px; }
              .summary { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .divider { border-top: 1px dashed #000; margin: 15px 0; }
              .table { width: 100%; border-collapse: collapse; }
              .table th { text-align: left; padding: 8px; background: #f2f2f2; }
              .table td { padding: 8px; border-bottom: 1px solid #ddd; }
              .total-row { font-weight: bold; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Sales Report</div>
              <div class="period">${reports.period}</div>
            </div>
            
            <div class="summary">
              <div>Total Sales: $${reports.totalSales.toFixed(2)}</div>
              <div>Items Sold: ${reports.totalItems}</div>
            </div>
            
            <div class="divider"></div>
            
            <table class="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Total Sales</th>
                </tr>
              </thead>
              <tbody>
                ${reports.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>$${item.totalSales.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="footer">Generated on ${new Date().toLocaleDateString()}</div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report');
    }
  };

  const handleDateChange = (date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setCustomDate(date);
    }
  };

  const selectPeriod = (value: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setPeriod(value);
    setShowPeriodPicker(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sales Reports</Text>
          
          <View style={styles.periodSelector}>
            <TouchableOpacity
              style={styles.periodButton}
              onPress={() => setShowPeriodPicker(true)}
            >
              <Text style={styles.periodButtonText}>
                {periodOptions.find(p => p.value === period)?.label}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={theme.text} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialIcons name="date-range" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>
          
          {showDatePicker && (
            <DateTimePicker
              value={customDate}
              onChange={(event, date) => handleDateChange(date)}
              mode="date"
            />
          )}
        </View>

        {reports ? (
          <>
            <View style={styles.summaryContainer}>
              <Text style={styles.periodText}>{reports.period}</Text>
              
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Total Sales</Text>
                  <Text style={styles.summaryValue}>${reports.totalSales.toFixed(2)}</Text>
                </View>
                
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Items Sold</Text>
                  <Text style={styles.summaryValue}>{reports.totalItems}</Text>
                </View>
              </View>
            </View>

            <View style={styles.reportHeader}>
              <Text style={styles.reportHeaderText}>ITEMS SOLD</Text>
            </View>

            {reports.items.map((item, index) => (
              <View key={`${item.id}-${index}`} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                </View>
                <Text style={styles.itemTotal}>${item.totalSales.toFixed(2)}</Text>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No sales data available</Text>
            <Text style={styles.emptySubtext}>for the selected period</Text>
          </View>
        )}
      </ScrollView>

      {reports && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: theme.primary }]}
            onPress={generatePDF}
          >
            <FontAwesome5 name="file-pdf" size={20} color="white" />
            <Text style={styles.footerButtonText}>Generate PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Period Picker Modal */}
      <Modal
        visible={showPeriodPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPeriodPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPeriodPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
              {periodOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalOption}
                  onPress={() => selectPeriod(option.value as any)}
                >
                  <Text style={[styles.modalOptionText, { color: theme.text }]}>
                    {option.label}
                  </Text>
                  {period === option.value && (
                    <MaterialIcons name="check" size={24} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
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
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 15,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  periodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 15,
    marginRight: 10,
  },
  periodButtonText: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
  },
  dateButton: {
    padding: 10,
  },
  summaryContainer: {
    marginBottom: 20,
  },
  periodText: {
    fontSize: 18,
    color: theme.textSecondary,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 5,
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primary,
  },
  reportHeader: {
    marginTop: 15,
    marginBottom: 10,
  },
  reportHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textSecondary,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: theme.text,
    marginBottom: 5,
  },
  itemQuantity: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
  },
  emptyContainer: {
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: theme.cardBackground,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
  },
  footerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  footerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
  },
});

export default ReportsScreen;