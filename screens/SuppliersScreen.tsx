import React, { useCallback, useState } from 'react';
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
import { listSuppliers, saveSupplier, type Supplier } from '../src/repositories/purchaseRepository';
import { notifyDataChanged } from '../src/services/dataEvents';
const blank = { name: '', phone: '', address: '', notes: '' };
export default function SuppliersScreen() {
  const { theme } = useTheme();
  const result = useQuery(useCallback(() => listSuppliers(), []));
  const action = useAction();
  const [form, setForm] = useState<Partial<Supplier> & { name: string }>(blank);
  const [search, setSearch] = useState('');
  return (
    <AppScreen theme={theme} keyboardAware>
      <Notice message={result.error || action.error} error onRetry={result.reload} />
      <Panel title={form.id ? 'Edit supplier' : 'New supplier'}>
        <Field
          label="Supplier name"
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
        />
        <Field
          label="Phone"
          value={form.phone}
          onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
          keyboardType="phone-pad"
          maxLength={30}
        />
        <Field
          label="Address"
          value={form.address}
          onChangeText={(address) => setForm((f) => ({ ...f, address }))}
          multiline
        />
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
          multiline
          maxLength={1000}
        />
        <AppButton
          theme={theme}
          label="Save supplier"
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              await saveSupplier(form);
              setForm(blank);
              notifyDataChanged();
            })
          }
        />
        {form.id && (
          <AppButton
            theme={theme}
            variant="secondary"
            label="Cancel edit"
            onPress={() => setForm(blank)}
          />
        )}
      </Panel>
      <Panel title="Supplier directory">
        <Field label="Find supplier" value={search} onChangeText={setSearch} />
        {result.loading ? (
          <Busy />
        ) : (
          (result.data ?? [])
            .filter((s) => (s.name + ' ' + s.phone).toLowerCase().includes(search.toLowerCase()))
            .map((s) => (
              <ListRow
                key={s.id}
                title={s.name}
                subtitle={[s.phone, s.address].filter(Boolean).join(' · ')}
                onPress={() => setForm(s)}
              />
            ))
        )}
        {!result.loading && !result.data?.length && (
          <Copy muted>Add suppliers here, then select them when receiving purchases.</Copy>
        )}
      </Panel>
    </AppScreen>
  );
}
