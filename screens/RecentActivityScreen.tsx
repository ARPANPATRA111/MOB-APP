import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppScreen from '../src/components/ui/AppScreen';
import AppButton from '../src/components/ui/AppButton';
import { Busy, Copy, Field, ListRow, Notice } from '../src/components/ui/CommerceUI';
import { useTheme } from '../src/contexts/ThemeContext';
import { formatCurrency } from '../src/domain/currency';
import { searchReceipts, type SaleHeader } from '../src/repositories/saleRepository';
import { useLiveData } from '../src/services/dataEvents';
export default function RecentActivityScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SaleHeader[]>([]);
  const rowsRef = useRef<SaleHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const fetching = useRef(false);
  const start = route.params?.start;
  const end = route.params?.end;
  const productId = route.params?.productId;
  useEffect(() => {
    const t = setTimeout(() => setSearch(query), 220);
    return () => clearTimeout(t);
  }, [query]);
  const load = useCallback(
    (append = false) => {
      if (append && fetching.current) return;
      const id = ++seq.current;
      fetching.current = true;
      setLoading(true);
      setError('');
      const last = append ? rowsRef.current.at(-1) : null;
      if (!append) {
        rowsRef.current = [];
        setRows([]);
      }
      searchReceipts(search, last ? { id: last.id, date: last.sale_date } : undefined, undefined, {
        start,
        end,
        productId,
      })
        .then((next) => {
          if (id === seq.current) {
            rowsRef.current = append ? [...rowsRef.current, ...next] : next;
            setRows(rowsRef.current);
            setMore(next.length === 40);
          }
        })
        .catch((e) => {
          if (id === seq.current) setError(e.message);
        })
        .finally(() => {
          if (id === seq.current) {
            fetching.current = false;
            setLoading(false);
          }
        });
    },
    [search, start, end, productId]
  );
  const refresh = useCallback(() => load(), [load]);
  useLiveData(refresh);
  return (
    <AppScreen theme={theme} scroll={false}>
      <Field
        label="Search receipts"
        value={query}
        onChangeText={setQuery}
        placeholder="Receipt number, customer, or phone"
      />
      {start !== undefined && (
        <Copy muted>
          {new Date(start).toLocaleDateString()} – {new Date(end).toLocaleDateString()}
        </Copy>
      )}
      <Notice message={error} error onRetry={refresh} />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        refreshing={loading && !rows.length}
        onRefresh={refresh}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <ListRow
            title={item.customer_name || 'Walk-in'}
            subtitle={`${item.sale_number}\n${new Date(item.sale_date).toLocaleString()}${item.due_cents > 0 ? ' · Due ' + formatCurrency(item.due_cents / 100, item.currency_code) : ''}`}
            trailing={formatCurrency(item.total_cents / 100, item.currency_code)}
            onPress={() => navigation.navigate('BillReceipt', { billId: item.id })}
          />
        )}
        ListEmptyComponent={loading ? <Busy /> : <Copy muted>No receipts match this view.</Copy>}
        ListFooterComponent={
          more ? (
            <AppButton
              theme={theme}
              variant="secondary"
              label="Load more receipts"
              loading={loading}
              onPress={() => load(true)}
            />
          ) : null
        }
      />
    </AppScreen>
  );
}
