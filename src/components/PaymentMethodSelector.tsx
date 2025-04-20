import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Theme } from '../contexts/ThemeContext';

interface PaymentMethodSelectorProps {
  selectedMethod: string;
  onSelectMethod: (method: string) => void;
  theme: Theme;
}

const paymentMethods = ['Cash', 'Credit Card', 'Debit Card', 'UPI'];

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onSelectMethod,
  theme,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {paymentMethods.map(method => (
        <TouchableOpacity
          key={method}
          style={[
            styles.methodButton,
            selectedMethod === method && styles.selectedMethodButton
          ]}
          onPress={() => onSelectMethod(method)}
        >
          <Text
            style={[
              styles.methodText,
              selectedMethod === method && styles.selectedMethodText
            ]}
          >
            {method}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  methodButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: theme.background,
    marginRight: 10,
    marginBottom: 10,
  },
  selectedMethodButton: {
    backgroundColor: theme.primary,
  },
  methodText: {
    color: theme.text,
  },
  selectedMethodText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default PaymentMethodSelector;