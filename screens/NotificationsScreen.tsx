import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppNavigation } from '../App';
import { useTheme, type Theme } from '../src/contexts/ThemeContext';
import { storageService } from '../src/services/storage';
import type { InventoryItem } from '../src/types';
import AppScreen from '../src/components/ui/AppScreen';
import AppBadge from '../src/components/ui/AppBadge';
import AppEmptyState from '../src/components/ui/AppEmptyState';
import { Skeleton, useDelayedFlag } from '../src/components/ui/Skeleton';
import { typography } from '../src/theme/typography';

type Props = {
  navigation: AppNavigation;
};

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayedFlag(loading);

  const load = useCallback(async () => {
    try {
      const items = await storageService.getLowStockProducts();
      setLowStock(items);
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
          <View style={{ paddingTop: 4 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} theme={theme} height={60} radius={12} style={{ marginBottom: 10 }} />
            ))}
          </View>
        ) : null}
      </AppScreen>
    );
  }

  return (
    <AppScreen theme={theme} scroll={false}>
      <FlatList
        data={lowStock}
        keyExtractor={(item) => item.barcode}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          lowStock.length > 0 ? (
            <Text style={styles.header}>Low stock — restock soon</Text>
          ) : null
        }
        ListEmptyComponent={
          <AppEmptyState theme={theme} title="All clear" message="No stock alerts right now." />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            accessibilityRole="button"
            // This screen lives in the root stack, so 'Inventory' is not a
            // sibling — navigate() only bubbles up, never down into the tab
            // navigator. Target the tab explicitly through its parent route.
            onPress={() => navigation.navigate('MainTabs', { screen: 'Inventory' })}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="alert-circle" size={20} color={theme.mode === 'dark' ? '#fbbf24' : '#b45309'} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.meta}>{item.barcode}</Text>
            </View>
            <AppBadge theme={theme} label={`${item.quantity} left`} tone="warning" />
          </TouchableOpacity>
        )}
      />
    </AppScreen>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    listContent: { paddingBottom: 24 },
    header: { color: theme.textSecondary, ...typography.caption, marginBottom: 10 },
    row: {
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.divider,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    iconWrap: { width: 28, alignItems: 'center' },
    copy: { flex: 1 },
    title: { color: theme.text, ...typography.bodyStrong },
    meta: { color: theme.textSecondary, ...typography.caption, marginTop: 2 },
  });

export default NotificationsScreen;
