import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Modal, View } from 'react-native';

import * as DocumentPicker from 'expo-document-picker';

import * as Sharing from 'expo-sharing';

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

import {
  applyFullRestore,
  createFullBackup,
  discardRestore,
  getBackupStatus,
  prepareRestore,
  type PreparedRestore,
} from '../src/services/fullBackup';

import { setBackupReminder } from '../src/services/backupReminders';

import { useDialog } from '../src/components/ui/DialogProvider';

export default function BackupScreen() {
  const { theme, setThemeMode } = useTheme();
  const currency = useCurrency();
  const action = useAction();
  const status = useQuery(useCallback(() => getBackupStatus(), []));
  const { confirm } = useDialog();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [prepared, setPrepared] = useState<PreparedRestore | null>(null);
  const preparedRef = useRef<PreparedRestore | null>(null);
  const [message, setMessage] = useState('');

  useEffect(
    () => () => {
      if (preparedRef.current) void discardRestore(preparedRef.current);
    },
    []
  );

  return (
    <AppScreen theme={theme} keyboardAware>
      <Notice message={action.error || status.error} error onRetry={status.reload} />
      <Notice message={message} />
      <Panel title="Protect your shop records">
        <Copy muted>
          Full encrypted backups include products, photos, bills, payments, suppliers, purchases,
          drafts, and settings. Keep a copy outside this phone. Your password is needed to restore
          it.
        </Copy>
        <Copy>
          Last created:{' '}
          {status.data?.createdAt
            ? new Date(status.data.createdAt).toLocaleString()
            : 'No full backup yet'}
        </Copy>

        <Field
          label="Backup password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={1024}
          hint="At least 10 characters. This password is not stored and cannot be recovered."
        />
        <Field
          label="Confirm password for a new backup"
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={1024}
        />

        <AppButton
          theme={theme}
          label="Create private backup"
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              if (password !== repeat) throw new Error('Passwords do not match.');
              await createFullBackup(password);
              status.reload();
              setMessage('Encrypted backup saved privately on this phone. Export a copy only when you choose.');
              setPassword('');
              setRepeat('');
            })
          }
        />

        {status.data?.fileUri && (
          <AppButton
            theme={theme}
            variant="secondary"
            label="Export backup copy"
            disabled={action.busy}
            onPress={() =>
              action.run(() =>
                Sharing.shareAsync(status.data!.fileUri!, {
                  mimeType: 'application/octet-stream',
                })
              )
            }
          />
        )}
      </Panel>
      {status.data?.safetyBackupUri && (
        <Panel title="Previous records">
          <Copy muted>Your pre-restore safety backup is kept separately.</Copy>
          <AppButton
            theme={theme}
            label="Share safety backup"
            variant="secondary"
            disabled={action.busy}
            onPress={() =>
              action.run(() =>
                Sharing.shareAsync(status.data!.safetyBackupUri!, {
                  mimeType: 'application/octet-stream',
                })
              )
            }
          />
        </Panel>
      )}
      <Panel title="Backup reminders">
        <Choices
          value={String(status.data?.reminderDays ?? 0)}
          options={[
            { value: '0', label: 'Off' },
            { value: '1', label: 'Daily' },
            { value: '7', label: 'Weekly' },
            { value: '30', label: 'Monthly' },
          ]}
          onChange={(v) =>
            action.run(async () => {
              await setBackupReminder(Number(v) as 0 | 1 | 7 | 30);
              status.reload();
            })
          }
        />
        <Copy muted>Reminders ask you to make a backup. They do not upload your data.</Copy>
      </Panel>

      <Panel title="Restore a backup">
        <Copy muted>
          Enter the backup password above, then choose a .mopx file. Review its contents before
          replacing this device’s records.
        </Copy>
        <AppButton
          theme={theme}
          variant="secondary"
          label="Choose backup to inspect"
          disabled={action.busy}
          onPress={() =>
            action.run(async () => {
              if (password.length < 10) throw new Error('Enter this backup’s password first.');
              const picked = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });
              if (picked.canceled) return;
              if (preparedRef.current) await discardRestore(preparedRef.current);
              preparedRef.current = null;
              setPrepared(null);
              const next = await prepareRestore(picked.assets[0].uri, password);
              preparedRef.current = next;
              setPrepared(next);
            })
          }
        />

        {prepared && (
          <>
            <Copy>Created {new Date(prepared.manifest.createdAt).toLocaleString()}</Copy>
            {Object.entries({
              products: 'Products',
              categories: 'Categories',
              sales: 'Receipts',
              payments: 'Payments',
              customers: 'Customers',
              suppliers: 'Suppliers',
              purchases: 'Purchases',
              bill_drafts: 'Saved bills',
            }).map(([table, label]) => (
              <ListRow
                key={table}
                title={label}
                trailing={String(prepared.manifest.counts[table])}
              />
            ))}
            <ListRow title="Photos" trailing={String(prepared.manifest.images.length)} />
            <Notice message="Restoring replaces the current records. A safety backup of this device will be created first using the entered password." />

            <AppButton
              theme={theme}
              variant="danger"
              label="Restore these records"
              loading={action.busy}
              onPress={async () => {
                if (
                  !(await confirm({
                    title: 'Replace device records?',
                    message:
                      'This restores the reviewed backup, including stock and customer balances. A safety backup of your current records is kept on this device.',
                    confirmText: 'Restore',
                    destructive: true,
                  }))
                )
                  return;
                await action.run(async () => {
                  await applyFullRestore(prepared, password);
                  setThemeMode(prepared.manifest.theme);
                  preparedRef.current = null;
                  setPrepared(null);
                  setPassword('');
                  setRepeat('');
                  await currency.refresh();
                  status.reload();
                  setMessage(
                    'Restore complete. Your previous records are kept in a private safety backup.'
                  );
                });
              }}
            />
            <AppButton
              theme={theme}
              variant="secondary"
              label="Cancel restore"
              onPress={() =>
                action.run(async () => {
                  await discardRestore(prepared);
                  preparedRef.current = null;
                  setPrepared(null);
                })
              }
            />
          </>
        )}
      </Panel>
      <Modal transparent visible={action.busy} onRequestClose={() => {}} animationType="none">
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000088',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <Panel>
            <Busy />
            <Copy>Working with your backup…</Copy>
            <Copy muted>Keep the app open until this finishes.</Copy>
          </Panel>
        </View>
      </Modal>
    </AppScreen>
  );
}
