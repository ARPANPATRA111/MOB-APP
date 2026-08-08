import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { useToast } from '../src/components/ui/ToastProvider';
import { useDialog } from '../src/components/ui/DialogProvider';
import {
  calculateCartMoneyTotals,
  removeCartItem,
  updateCartQuantity,
  type CartItem,
} from '../src/domain/cart';
import { PAYMENT_METHODS, type PaymentMethod } from '../src/domain/payment';
import { canSubmitCheckout, validateCartForCheckout } from '../src/domain/scannerCart';
import { billingSession } from '../src/services/billingSession';
import { storageService } from '../src/services/storage';
import AppButton from '../src/components/ui/AppButton';
import AppCard from '../src/components/ui/AppCard';
import AppEmptyState from '../src/components/ui/AppEmptyState';
import AppInput from '../src/components/ui/AppInput';
import AppScreen from '../src/components/ui/AppScreen';
import BottomActionBar from '../src/components/ui/BottomActionBar';
import SectionHeader from '../src/components/ui/SectionHeader';
import { typography } from '../src/theme/typography';

const TAX_RATE = 0.05;

const BillReviewScreen: React.FC<{ navigation: StackNavigationProp<RootStackParamList, 'BillReview'> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const currency = useCurrency();
  const toast = useToast();
  const dialog = useDialog();
  const styles = createStyles(theme);
  const [cart, setCart] = useState<CartItem[]>(() => billingSession.getCart());
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [billDiscount, setBillDiscount] = useState('0');
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const discountAmount = Number(billDiscount) || 0;
  const totals = useMemo(() => (
    cart.length ? calculateCartMoneyTotals(cart, discountAmount, taxEnabled ? TAX_RATE : 0) : { subtotal: 0, discount: 0, tax: 0, total: 0 }
  ), [cart, discountAmount, taxEnabled]);

  const updateCart = (nextCart: CartItem[]) => {
    setCart(nextCart);
    billingSession.setCart(nextCart);
  };

  const changeQuantity = (item: CartItem, quantity: number) => {
    try {
      updateCart(updateCartQuantity(cart, item.id, quantity, item.availableStock));
    } catch (error) {
      toast.showToast({ message: (error as Error).message, variant: 'warning' });
    }
  };

  const createBill = async () => {
    if (!canSubmitCheckout(cart, submitting, discountAmount, taxEnabled ? TAX_RATE : 0)) {
      return;
    }

    try {
      validateCartForCheckout(cart);
    } catch (error) {
      void dialog.alert({ title: 'Review cart', message: (error as Error).message });
      return;
    }

    setSubmitting(true);
    try {
      const billId = `BILL-${Date.now()}`;
      await storageService.createBill({
        id: billId,
        items: cart.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          image: item.image,
          discount: item.discount,
        })),
        total: totals.total,
        customerName,
        customerPhone,
        timestamp: Date.now(),
        paymentMethod,
        billDiscount: discountAmount,
        taxRate: taxEnabled ? TAX_RATE : 0,
      });
      billingSession.clear();
      navigation.replace('BillReceipt', { billId });
    } catch (error) {
      void dialog.alert({ title: 'Bill failed', message: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppScreen
      theme={theme}
      keyboardAware
      footer={(
        <BottomActionBar theme={theme}>
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.footerLabel}>Grand total</Text>
              <Text style={styles.footerTotal}>{currency.format(totals.total)}</Text>
            </View>
            <AppButton label="Create Bill" theme={theme} onPress={createBill} loading={submitting} disabled={cart.length === 0} style={styles.createButton} />
          </View>
        </BottomActionBar>
      )}
    >
      <View style={styles.header}>
        <Text style={styles.subtitle}>Validate items and payment before saving</Text>
        <TouchableOpacity style={styles.addMoreButton} onPress={() => navigation.goBack()}>
          <Ionicons name="add" size={18} color={theme.primary} />
          <Text style={styles.addMoreText}>Add more</Text>
        </TouchableOpacity>
      </View>

      <AppCard theme={theme} style={styles.section}>
        <SectionHeader theme={theme} title="Items" subtitle={`${cart.length} products`} />
        {cart.length === 0 ? (
          <AppEmptyState theme={theme} title="Cart is empty" message="Go back and scan products first." />
        ) : (
          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemMeta}>Rate {currency.format(item.price)}</Text>
                </View>
                <View style={styles.qtyControls}>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(item, item.quantity - 1)}>
                    <Text style={styles.qtyText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity style={styles.qtyButton} onPress={() => changeQuantity(item, item.quantity + 1)}>
                    <Text style={styles.qtyText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemTotal}>{currency.format(item.total)}</Text>
                <TouchableOpacity style={styles.removeButton} onPress={() => updateCart(removeCartItem(cart, item.id))}>
                  <Ionicons name="trash-outline" size={19} color="#dc2626" />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </AppCard>

      <AppCard theme={theme} style={styles.section}>
        <SectionHeader theme={theme} title="Customer and payment" />
        <View style={styles.inputRow}>
          <AppInput theme={theme} placeholder="Customer name optional" value={customerName} onChangeText={setCustomerName} style={styles.input} />
          <AppInput theme={theme} placeholder="Phone optional" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" style={styles.input} />
        </View>
        <View style={styles.paymentRow}>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method}
              style={[styles.paymentPill, paymentMethod === method && styles.paymentPillActive]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={[styles.paymentText, paymentMethod === method && styles.paymentTextActive]}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      <AppCard theme={theme} style={styles.section}>
        <SectionHeader theme={theme} title="Totals" />
        <View style={styles.inputRow}>
          <AppInput theme={theme} placeholder="Bill discount" value={billDiscount} onChangeText={setBillDiscount} keyboardType="decimal-pad" style={styles.input} />
          <TouchableOpacity style={[styles.taxToggle, taxEnabled && styles.taxToggleActive]} onPress={() => setTaxEnabled((value) => !value)}>
            <Text style={[styles.taxText, taxEnabled && styles.taxTextActive]}>Tax {taxEnabled ? '5%' : 'Off'}</Text>
          </TouchableOpacity>
        </View>
        <InfoRow label="Subtotal" value={currency.format(totals.subtotal)} theme={theme} />
        <InfoRow label="Discount" value={currency.format(totals.discount)} theme={theme} />
        <InfoRow label="Tax" value={currency.format(totals.tax)} theme={theme} />
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
  row: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: typography.body,
  value: typography.bodyStrong,
});

const createStyles = (theme: Theme) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  title: { color: theme.text, ...typography.sectionTitle },
  subtitle: { color: theme.textSecondary, ...typography.caption },
  addMoreButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.divider,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.cardBackground,
  },
  addMoreText: { color: theme.primary, ...typography.caption },
  section: { marginBottom: 10, padding: 12, gap: 10 },
  itemRow: {
    minHeight: 54,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
  },
  itemInfo: { flex: 1 },
  itemName: { color: theme.text, ...typography.bodyStrong },
  itemMeta: { color: theme.textSecondary, ...typography.caption },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  qtyButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.inputBackground, alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: theme.text, fontSize: 17, fontWeight: '900' },
  qtyValue: { color: theme.text, minWidth: 22, textAlign: 'center', fontWeight: '800' },
  itemTotal: { color: theme.text, width: 82, textAlign: 'right', ...typography.caption },
  removeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1 },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentPill: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.inputBackground,
  },
  paymentPillActive: { backgroundColor: theme.primary },
  paymentText: { color: theme.text, ...typography.caption },
  paymentTextActive: { color: '#ffffff' },
  taxToggle: { flex: 1, minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.inputBackground },
  taxToggleActive: { backgroundColor: theme.mode === 'dark' ? '#14532d' : '#dcfce7' },
  taxText: { color: theme.text, ...typography.bodyStrong },
  taxTextActive: { color: theme.mode === 'dark' ? '#dcfce7' : '#166534' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footerLabel: { color: theme.textSecondary, ...typography.caption },
  footerTotal: { color: theme.text, ...typography.stat },
  createButton: { minWidth: 150 },
});

export default BillReviewScreen;
