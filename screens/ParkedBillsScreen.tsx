import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AppScreen from '../src/components/ui/AppScreen';
import AppButton from '../src/components/ui/AppButton';
import { Busy, Copy, Notice, Panel, useAction, useQuery } from '../src/components/ui/CommerceUI';
import { useTheme } from '../src/contexts/ThemeContext';
import { deleteDraft, listDrafts, type CheckoutDraft } from '../src/repositories/draftRepository';
import { billingSession } from '../src/services/billingSession';
import { notifyDataChanged } from '../src/services/dataEvents';
import { useDialog } from '../src/components/ui/DialogProvider';
export default function ParkedBillsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const result = useQuery(useCallback(() => listDrafts(), []));
  const action = useAction();
  const { confirm } = useDialog();
  return (
    <AppScreen theme={theme} scroll={false}>
      <Notice message={result.error || action.error} error onRetry={result.reload} />
      <FlatList
        data={result.data ?? []}
        keyExtractor={(r) => r.id}
        refreshing={result.loading}
        onRefresh={result.reload}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Panel title={item.label}>
            <Copy muted>
              {item.state === 'active' ? 'Unfinished' : 'Parked'} ·{' '}
              {new Date(item.updated_at).toLocaleString()}
            </Copy>
            <AppButton
              theme={theme}
              label="Resume bill"
              disabled={action.busy}
              onPress={() =>
                action.run(async () => {
                  const draft = JSON.parse(item.payload_json) as CheckoutDraft;
                  if (
                    draft.id !== item.id ||
                    !Array.isArray(draft.cart) ||
                    !draft.cart.length ||
                    draft.cart.length > 200
                  )
                    throw new Error('This saved cart is invalid. Its raw data remains in backups.');
                  await billingSession.resume(draft);
                  navigation.navigate('Billing');
                })
              }
            />
            <AppButton
              theme={theme}
              variant="secondary"
              label="Discard"
              disabled={action.busy}
              onPress={() =>
                action.run(async () => {
                  if (
                    await confirm({
                      title: 'Discard this bill?',
                      message: 'No sale or stock change has been recorded for this draft.',
                      confirmText: 'Discard',
                      destructive: true,
                    })
                  ) {
                    await billingSession.flush();
                      if (billingSession.getSnapshot().id === item.id) billingSession.clear();
                    await deleteDraft(item.id);
                    notifyDataChanged();
                  }
                })
              }
            />
          </Panel>
        )}
        ListEmptyComponent={
          result.loading ? (
            <Busy />
          ) : (
            <Panel>
              <Copy>No unfinished bills.</Copy>
              <Copy muted>
                Park a bill from checkout, or return here after closing the app during billing.
              </Copy>
            </Panel>
          )
        }
      />
    </AppScreen>
  );
}
