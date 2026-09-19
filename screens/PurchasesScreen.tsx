import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppScreen from '../src/components/ui/AppScreen';
import AppButton from '../src/components/ui/AppButton';
import {
  Busy,
  Copy,
  Field,
  ListRow,
  Notice,
  Panel,
  useAction,
  useQuery,
} from '../src/components/ui/CommerceUI';
import { useTheme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import { createLocalId } from '../src/db/schema';
import { toCents } from '../src/domain/money';
import { quantityCostCents } from '../src/domain/commerce';
import { listProductPage, type ProductRecord } from '../src/repositories/productRepository';
import {
  createPurchase,
  getPurchaseItems,
  listPurchases,
  listSuppliers,
} from '../src/repositories/purchaseRepository';
import { notifyDataChanged } from '../src/services/dataEvents';
type Line = { product: ProductRecord; quantity: string; cost: string };
export default function PurchasesScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const action = useAction();
  const history = useQuery(useCallback(() => listPurchases(), []));
  const suppliers = useQuery(useCallback(() => listSuppliers(), []));
  const [supplierId, setSupplier] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [query, setQuery] = useState('');
  const products = useQuery(useCallback(() => listProductPage({ query, limit: 8 }), [query]));
  const [lines, setLines] = useState<Line[]>([]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const purchaseId = useRef(createLocalId('purchase'));
  const [expanded, setExpanded] = useState('');
  const details = useQuery(
    useCallback(() => (expanded ? getPurchaseItems(expanded) : Promise.resolve([])), [expanded])
  );
  let total = 0;
  let invalid = '';
  try {
    for (const line of lines) {
      if (!line.quantity.trim() || !line.cost.trim())
        throw new Error('Enter quantity and unit cost for every line.');
      total += quantityCostCents(Number(line.quantity), toCents(line.cost));
    }
    if (!Number.isSafeInteger(total) || total < 0) throw new Error('Check purchase amounts.');
  } catch (e) {
    invalid = (e as Error).message;
  }
  const change = (index: number, key: 'quantity' | 'cost', value: string) =>
    setLines((old) => old.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  return (
    <AppScreen theme={theme} keyboardAware>
      <Notice
        message={action.error || history.error || suppliers.error}
        error
        onRetry={() => {
          history.reload();
          suppliers.reload();
        }}
      />
      <Panel title="Receive a purchase">
        <Copy muted>Receiving stock updates quantities and average costs together.</Copy>
        <Field
          label="Find supplier (optional)"
          value={supplierSearch}
          onChangeText={setSupplierSearch}
        />
        <Copy>
          {supplierId
            ? `Selected: ${suppliers.data?.find((s) => s.id === supplierId)?.name ?? 'Supplier'}`
            : 'Direct restock — no supplier selected'}
        </Copy>
        {supplierSearch &&
          (suppliers.data ?? [])
            .filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
            .slice(0, 8)
            .map((s) => (
              <ListRow
                key={s.id}
                title={s.name}
                subtitle={s.phone}
                onPress={() => {
                  setSupplier(s.id);
                  setSupplierSearch('');
                }}
              />
            ))}
        {supplierId && (
          <AppButton
            theme={theme}
            variant="secondary"
            label="Clear supplier"
            onPress={() => setSupplier('')}
          />
        )}
        <AppButton
          theme={theme}
          variant="secondary"
          label="Manage suppliers"
          onPress={() => navigation.navigate('Suppliers')}
        />
        <Field label="Supplier invoice / reference" value={reference} onChangeText={setReference} />
        <Field label="Find product to restock" value={query} onChangeText={setQuery} />
        {products.loading ? (
          <Busy />
        ) : (
          (products.data ?? []).map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={`${p.stockQuantity} ${p.unit} on hand`}
              icon="add-circle-outline"
              onPress={() => {
                if (lines.some((l) => l.product.id === p.id)) return;
                setLines((old) => [
                  ...old,
                  {
                    product: p,
                    quantity: '1',
                    cost: p.costCents == null ? '' : String(p.costCents / 100),
                  },
                ]);
                setQuery('');
              }}
            />
          ))
        )}
      </Panel>
      {lines.map((line, index) => (
        <Panel key={line.product.id} title={line.product.name}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={`Received (${line.product.unit})`}
                value={line.quantity}
                onChangeText={(v) => change(index, 'quantity', v)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Cost per unit"
                value={line.cost}
                onChangeText={(v) => change(index, 'cost', v)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {line.product.costCents == null && line.product.stockQuantity > 0 && (
            <Copy muted>
              Existing stock has no recorded cost. Set its average cost in Inventory to calculate a
              complete valuation.
            </Copy>
          )}
          <AppButton
            theme={theme}
            variant="secondary"
            label="Remove line"
            onPress={() => setLines((old) => old.filter((_, i) => i !== index))}
          />
        </Panel>
      ))}
      {lines.length > 0 && (
        <Panel title="Purchase summary">
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
          <Copy>Total cost: {currency.format(Number.isFinite(total) ? total / 100 : 0)}</Copy>
          <Notice message={invalid} error />
          <AppButton
            theme={theme}
            label="Receive stock"
            loading={action.busy}
            disabled={!!invalid}
            onPress={() =>
              action.run(async () => {
                await createPurchase({
                  id: purchaseId.current,
                  supplierId: supplierId || undefined,
                  reference,
                  date: Date.now(),
                  notes,
                  items: lines.map((l) => ({
                    productId: l.product.id,
                    quantity: Number(l.quantity),
                    unitCostCents: toCents(l.cost),
                  })),
                });
                purchaseId.current = createLocalId('purchase');
                setLines([]);
                setReference('');
                setNotes('');
                notifyDataChanged();
              })
            }
          />
        </Panel>
      )}
      <Panel title="Recent purchases">
        <Copy muted>Latest 100 purchases</Copy>
        {history.loading ? (
          <Busy />
        ) : !history.data?.length ? (
          <Copy muted>Received purchases will appear here.</Copy>
        ) : (
          history.data.map((p) => (
            <View key={p.id}>
              <ListRow
                title={p.supplier_name}
                subtitle={`${new Date(p.purchase_date).toLocaleDateString()} · ${p.reference || 'No reference'}`}
                trailing={currency.format(p.total_cents / 100)}
                onPress={() => setExpanded(expanded === p.id ? '' : p.id)}
              />
              {expanded === p.id &&
                (details.loading ? (
                  <Busy />
                ) : (
                  <>
                    <Notice message={details.error} error onRetry={details.reload} />
                    {details.data?.map((l, i) => (
                      <ListRow
                        key={i}
                        title={l.product_name}
                        subtitle={`${l.quantity} ${l.unit} × ${currency.format(l.unit_cost_cents / 100)}`}
                        trailing={currency.format(l.total_cents / 100)}
                      />
                    ))}
                  </>
                ))}
            </View>
          ))
        )}
      </Panel>
    </AppScreen>
  );
}
