import React, { useEffect, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RootStackParamList } from '../App';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { storageService } from '../src/services/storage';
import type { ReceiptData } from '../src/domain/receipt';
import AppButton from '../src/components/ui/AppButton';
import AppCard from '../src/components/ui/AppCard';
import AppEmptyState from '../src/components/ui/AppEmptyState';
import AppLoadingState from '../src/components/ui/AppLoadingState';
import AppScreen from '../src/components/ui/AppScreen';
import BottomActionBar from '../src/components/ui/BottomActionBar';

interface Props {
  navigation: StackNavigationProp<RootStackParamList, 'BillReceipt'>;
  route: RouteProp<RootStackParamList, 'BillReceipt'>;
}

const BillReceiptScreen: React.FC<Props> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const currency = useCurrency();
  const styles = createStyles(theme);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const loadReceipt = async () => {
      try {
        const data = await storageService.getReceiptData(route.params.billId);
        setReceipt(data);
      } catch (error) {
        console.error('Receipt load failed:', error);
        Alert.alert('Receipt unavailable', 'Unable to load this saved sale.');
      } finally {
        setLoading(false);
      }
    };
    void loadReceipt();
  }, [route.params.billId]);

  const shareReceipt = async () => {
    if (!receipt) {
      return;
    }
    setSharing(true);
    try {
      const html = await storageService.getReceiptHtml(receipt.saleId);
      if (!html) {
        throw new Error('Saved sale could not be formatted');
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS === 'android' && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: `Share receipt ${receipt.saleNumber}`,
        });
      } else {
        await Share.share({ url: uri, title: `Receipt ${receipt.saleNumber}` });
      }
    } catch (error) {
      Alert.alert('Share failed', (error as Error).message);
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return <AppLoadingState theme={theme} label="Loading saved receipt..." />;
  }

  if (!receipt) {
    return (
      <AppScreen theme={theme}>
        <AppCard theme={theme}>
          <AppEmptyState theme={theme} title="Receipt not found" message="This bill was not found in the local sales database." />
          <AppButton label="Back to Billing" theme={theme} onPress={() => navigation.navigate('Billing')} />
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      theme={theme}
      footer={(
        <BottomActionBar theme={theme}>
          <View style={styles.actions}>
            <AppButton label="New Bill" theme={theme} variant="secondary" onPress={() => navigation.navigate('Billing')} style={styles.actionButton} />
            <AppButton label="Share PDF" theme={theme} onPress={shareReceipt} loading={sharing} style={styles.actionButton} />
          </View>
        </BottomActionBar>
      )}
    >
      <AppCard theme={theme} style={styles.receiptCard}>
        <View style={styles.storeHeader}>
          <Text style={styles.storeName}>{receipt.businessName}</Text>
          {receipt.ownerName ? <Text style={styles.muted}>Owner: {receipt.ownerName}</Text> : null}
          {receipt.businessAddress ? <Text style={styles.muted}>{receipt.businessAddress}</Text> : null}
          {receipt.businessPhone ? <Text style={styles.muted}>{receipt.businessPhone}</Text> : null}
          {receipt.gstin ? <Text style={styles.muted}>GSTIN: {receipt.gstin}</Text> : null}
        </View>

        <View style={styles.divider} />
        <InfoRow label="Bill" value={receipt.saleNumber} theme={theme} />
        <InfoRow label="Date" value={receipt.date} theme={theme} />
        <InfoRow label="Customer" value={receipt.customerName} theme={theme} />
        {receipt.customerPhone ? <InfoRow label="Phone" value={receipt.customerPhone} theme={theme} /> : null}
        <InfoRow label="Payment" value={receipt.paymentSummary} theme={theme} />
        <View style={styles.divider} />

        {receipt.items.map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.muted}>{item.quantity} x {currency.format(item.unitPrice)}</Text>
            </View>
            <Text style={styles.itemTotal}>{currency.format(item.total)}</Text>
          </View>
        ))}

        <View style={styles.divider} />
        <InfoRow label="Subtotal" value={currency.format(receipt.subtotal)} theme={theme} />
        <InfoRow label="Discount" value={currency.format(receipt.discount)} theme={theme} />
        <InfoRow label="Tax" value={currency.format(receipt.tax)} theme={theme} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{currency.format(receipt.total)}</Text>
        </View>
        <Text style={styles.footerText}>{receipt.footerMessage}</Text>
      </AppCard>
    </AppScreen>
  );
};

const InfoRow = ({ label, value, theme }: { label: string; value: string; theme: Theme }) => (
  <View style={infoStyles.row}>
    <Text style={[infoStyles.label, { color: theme.textSecondary }]}>{label}</Text>
    <Text style={[infoStyles.value, { color: theme.text }]}>{value}</Text>
  </View>
);

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  label: { fontSize: 14 },
  value: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700' },
});

const createStyles = (theme: Theme) => StyleSheet.create({
  receiptCard: { gap: 8 },
  storeHeader: { alignItems: 'center', gap: 4 },
  storeName: { color: theme.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  muted: { color: theme.textSecondary, fontSize: 12 },
  divider: { height: 1, backgroundColor: theme.divider, marginVertical: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  itemInfo: { flex: 1 },
  itemName: { color: theme.text, fontSize: 15, fontWeight: '700' },
  itemTotal: { color: theme.text, fontSize: 15, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  totalLabel: { color: theme.text, fontSize: 20, fontWeight: '900' },
  totalAmount: { color: theme.primary, fontSize: 20, fontWeight: '900' },
  footerText: { color: theme.textSecondary, textAlign: 'center', marginTop: 18, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1 },
});

export default BillReceiptScreen;
