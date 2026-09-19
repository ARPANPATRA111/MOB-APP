import React from 'react';
import { useNavigation } from '@react-navigation/native';
import AppScreen from '../src/components/ui/AppScreen';
import { Group, ListRow } from '../src/components/ui/CommerceUI';
import { useTheme } from '../src/contexts/ThemeContext';
export default function ManagementScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <AppScreen theme={theme}>
      <Group title="Everyday">
        <ListRow
          title="Parked bills"
          iconColor="#ff9500"
          subtitle="Pick up an unfinished checkout"
          icon="pause-circle"
          onPress={() => navigation.navigate('ParkedBills')}
        />
        <ListRow
          title="Purchases & restocking"
          iconColor="#0a7aff"
          subtitle="Receive stock and review purchases"
          icon="cube"
          onPress={() => navigation.navigate('Purchases')}
        />
        <ListRow
          title="Suppliers"
          iconColor="#5856d6"
          subtitle="Contacts and purchasing details"
          icon="people"
          onPress={() => navigation.navigate('Suppliers')}
        />
        <ListRow
          title="Customer credit"
          iconColor="#34c759"
          subtitle="Balances and installment payments"
          icon="wallet"
          onPress={() => navigation.navigate('Credit')}
        />
        <ListRow
          title="Receipts"
          iconColor="#ff2d55"
          subtitle="Find, share, and reprint bills"
          icon="receipt"
          onPress={() => navigation.navigate('RecentActivity')}
        />
        <ListRow
          title="Stock history"
          iconColor="#8e8e93"
          subtitle="Trace every sale, restock, and adjustment"
          icon="time"
          onPress={() => navigation.navigate('StockHistory')}
        />
      </Group>
      <Group title="Tools">
        <ListRow
          title="Import products"
          iconColor="#5ac8fa"
          subtitle="Review CSV changes before applying"
          icon="document-text"
          onPress={() => navigation.navigate('Import')}
        />
        <ListRow
          title="Receipt printer"
          iconColor="#af52de"
          subtitle="Android print, Bluetooth, or network"
          icon="print"
          onPress={() => navigation.navigate('Printer')}
        />
      </Group>
    </AppScreen>
  );
}
