import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import AppScreen from '../src/components/ui/AppScreen';
import { Busy, Copy, ListRow, Notice, useQuery } from '../src/components/ui/CommerceUI';
import { useTheme } from '../src/contexts/ThemeContext';
import { listStockHistory } from '../src/repositories/inventoryRepository';
export default function StockHistoryScreen() {
  const { theme } = useTheme();
  const result = useQuery(useCallback(() => listStockHistory(), []));
  return (
    <AppScreen theme={theme} scroll={false}>
      <Copy muted>Latest 100 stock movements</Copy>
      <Notice message={result.error} error onRetry={result.reload} />
      <FlatList
        data={result.data ?? []}
        keyExtractor={(r) => r.id}
        refreshing={result.loading}
        onRefresh={result.reload}
        renderItem={({ item }) => (
          <ListRow
            title={item.product_name}
            subtitle={`${item.reason || item.movement_type} · ${new Date(item.created_at).toLocaleString()}\nStock after: ${item.stock_after}`}
            trailing={`${item.quantity_delta > 0 ? '+' : ''}${item.quantity_delta}`}
          />
        )}
        ListEmptyComponent={result.loading ? <Busy /> : <Copy muted>No stock movements yet.</Copy>}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </AppScreen>
  );
}
