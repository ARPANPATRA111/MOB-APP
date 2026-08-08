import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { storageService } from '../src/services/storage';
import type { Bill } from '../src/types';
import AppScreen from '../src/components/ui/AppScreen';
import AppEmptyState from '../src/components/ui/AppEmptyState';
import { Skeleton, useDelayedFlag } from '../src/components/ui/Skeleton';
import { typography } from '../src/theme/typography';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'RecentActivity'>;
};

const RecentActivityScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const currency = useCurrency();
  const styles = createStyles(theme);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedFlag(loading);

  const load = useCallback(async () => {
    try {
      const all = await storageService.getBills();
      setBills([...all].sort((a, b) => b.timestamp - a.timestamp));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AppScreen theme={theme} scroll={false}>
        {showSkeleton ? (
          <View style={styles.skeletonWrap}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} theme={theme} height={64} radius={12} style={{ marginBottom: 10 }} />
            ))}
          </View>
        ) : null}
      </AppScreen>
    );
  }

  return (
    <AppScreen theme={theme} scroll={false}>
      <FlatList
        data={bills}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <AppEmptyState theme={theme} title="No orders yet" message="Saved bills will appear here." />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            accessibilityRole="button"
            onPress={() => navigation.navigate('BillReceipt', { billId: item.id })}
          >
            <View style={styles.copy}>
              <Text style={styles.title}>{item.customerName || 'Walk-in customer'}</Text>
              <Text style={styles.meta}>
                {new Date(item.timestamp).toLocaleString()} · {item.paymentMethod}
              </Text>
            </View>
            <Text style={styles.amount}>{currency.format(item.total)}</Text>
          </TouchableOpacity>
        )}
      />
    </AppScreen>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    skeletonWrap: { paddingTop: 4 },
    listContent: { paddingBottom: 24 },
    row: {
      minHeight: 62,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.divider,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    copy: { flex: 1 },
    title: { color: theme.text, ...typography.bodyStrong },
    meta: { color: theme.textSecondary, ...typography.caption, marginTop: 2 },
    amount: { color: theme.primary, ...typography.bodyStrong },
  });

export default RecentActivityScreen;
