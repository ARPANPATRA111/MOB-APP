import React, { useCallback, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import AppScreen from '../src/components/ui/AppScreen';
import AppButton from '../src/components/ui/AppButton';
import {
  Busy,
  Choices,
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
import { formatCurrency } from '../src/domain/currency';
import { toCents } from '../src/domain/money';
import { createLocalId } from '../src/db/schema';
import {
  getCreditSummary,
  listCreditBills,
  recordInstallment,
} from '../src/repositories/creditRepository';
import { getSaleById } from '../src/repositories/saleRepository';
import { notifyDataChanged } from '../src/services/dataEvents';
export default function CreditScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>(route.params?.billId ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const paymentId = useRef(createLocalId('installment'));
  const action = useAction();
  const summary = useQuery(useCallback(() => getCreditSummary(), []));
  const bills = useQuery(useCallback(() => listCreditBills(query), [query]));
  const sale = useQuery(
    useCallback(() => (selected ? getSaleById(selected) : Promise.resolve(null)), [selected])
  );
  return (
    <AppScreen theme={theme} keyboardAware>
      <Notice
        message={action.error || summary.error || bills.error || sale.error}
        error
        onRetry={() => {
          summary.reload();
          bills.reload();
          sale.reload();
        }}
      />
      <Panel title="Customer credit">
        <Copy large>{currency.format((summary.data?.due_cents ?? 0) / 100)}</Copy>
        <Copy muted>
          {summary.data?.count ?? 0} open bills ·{' '}
          {currency.format((summary.data?.overdue_cents ?? 0) / 100)} overdue
        </Copy>
      </Panel>
      {selected && (
        <Panel title={sale.data?.customerName || 'Selected bill'}>
          {sale.loading ? (
            <Busy />
          ) : (
            sale.data && (
              <>
                <Copy muted>
                  {sale.data.saleNumber} · {sale.data.customerPhone || 'No phone saved'}
                </Copy>
                <Copy>
                  Remaining:{' '}
                  {formatCurrency((sale.data.dueCents ?? 0) / 100, sale.data.currencyCode)}
                </Copy>
                {sale.data.payments.map((p, i) => (
                  <ListRow
                    key={p.id ?? i}
                    title={p.method}
                    subtitle={`${p.paid_at ? new Date(p.paid_at).toLocaleString() : ''}${p.reference ? ' · ' + p.reference : ''}`}
                    trailing={formatCurrency(p.amount_cents / 100, sale.data.currencyCode)}
                  />
                ))}
                {(sale.data.dueCents ?? 0) > 0 && (
                  <>
                    <Field
                      label="Installment received"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                    />
                    <Choices
                      value={method}
                      onChange={setMethod}
                      options={['Cash', 'UPI', 'Card', 'Bank'].map((value) => ({
                        value,
                        label: value,
                      }))}
                    />
                    <Field
                      label="Payment reference (optional)"
                      value={reference}
                      onChangeText={setReference}
                    />
                    <AppButton
                      theme={theme}
                      label="Record installment"
                      loading={action.busy}
                      onPress={() =>
                        action.run(async () => {
                          await recordInstallment({
                            id: paymentId.current,
                            saleId: selected,
                            amountCents: toCents(amount),
                            method,
                            reference,
                          });
                          paymentId.current = createLocalId('installment');
                          setAmount('');
                          setReference('');
                          notifyDataChanged();
                        })
                      }
                    />
                  </>
                )}
                <AppButton
                  theme={theme}
                  variant="secondary"
                  label="View updated receipt"
                  onPress={() => navigation.navigate('BillReceipt', { billId: selected })}
                />
                <AppButton
                  theme={theme}
                  variant="secondary"
                  label="Close bill details"
                  onPress={() => setSelected('')}
                />
              </>
            )
          )}
        </Panel>
      )}
      <Panel title="Unpaid bills">
        <Field label="Search customer or phone" value={query} onChangeText={setQuery} />
        {bills.loading ? (
          <Busy />
        ) : bills.data?.length ? (
          bills.data.map((b) => (
            <ListRow
              key={b.id}
              title={b.customer_name || 'Customer'}
              subtitle={`${b.sale_number}${b.due_date ? ' · Due ' + new Date(b.due_date).toLocaleDateString() : ''}`}
              trailing={formatCurrency(b.due_cents / 100, b.currency_code)}
              onPress={() => {
                setSelected(b.id);
                setAmount('');
                setReference('');
                paymentId.current = createLocalId('installment');
              }}
            />
          ))
        ) : (
          <Copy muted>No unpaid bills match this view.</Copy>
        )}
      </Panel>
    </AppScreen>
  );
}
