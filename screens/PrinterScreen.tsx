import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import AppScreen from '../src/components/ui/AppScreen';
import AppButton from '../src/components/ui/AppButton';
import {
  Choices,
  Copy,
  Field,
  ListRow,
  Notice,
  Panel,
  useAction,
} from '../src/components/ui/CommerceUI';
import { useTheme } from '../src/contexts/ThemeContext';
import { useCurrency } from '../src/contexts/CurrencyContext';
import {
  getPairedPrinters,
  getPrinterConfig,
  printReceipt,
  savePrinterConfig,
  type PrinterConfig,
} from '../src/services/receiptPrinting';
export default function PrinterScreen() {
  const { theme } = useTheme();
  const currency = useCurrency();
  const action = useAction();
  const setActionError = action.setError;
  const [config, setConfig] = useState<PrinterConfig>({
    transport: 'system',
    address: '',
    port: 9100,
    width: 384,
  });
  const [port, setPort] = useState('9100');
  const [paired, setPaired] = useState<{ name: string; address: string }[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    getPrinterConfig()
      .then((c) => {
        setConfig(c);
        setPort(String(c.port));
      })
      .catch((e) => setActionError(e.message));
  }, [setActionError]);
  const current = { ...config, port: Number(port) };
  return (
    <AppScreen theme={theme} keyboardAware>
      <Notice message={action.error} error />
      <Notice message={message} />
      <Panel title="Receipt printing">
        <Choices
          value={config.transport}
          options={[
            { value: 'system', label: 'Android print' },
            { value: 'bluetooth', label: 'Bluetooth' },
            { value: 'network', label: 'Network' },
          ]}
          onChange={(transport) => setConfig((c) => ({ ...c, transport, address: '' }))}
        />
        {config.transport === 'system' ? (
          <Copy muted>
            Use Android’s print dialog to select an installed printer service or save as PDF.
          </Copy>
        ) : (
          <>
            <Copy muted>
              For ESC/POS thermal printers. Bluetooth Classic and network TCP are supported.
              BLE-only and proprietary printers need their manufacturer’s Android print service.
            </Copy>
            <Choices
              value={String(config.width)}
              options={[
                { value: '384', label: '58 mm' },
                { value: '576', label: '80 mm' },
              ]}
              onChange={(width) => setConfig((c) => ({ ...c, width: Number(width) as 384 | 576 }))}
            />
          </>
        )}
        {config.transport === 'bluetooth' && (
          <>
            <Copy muted>Pair your printer in Android settings, then refresh this list.</Copy>
            <AppButton
              theme={theme}
              variant="secondary"
              label="Android settings"
              onPress={() => void Linking.openSettings()}
            />
            <AppButton
              theme={theme}
              label="Find paired printers"
              loading={action.busy}
              onPress={() => action.run(async () => setPaired(await getPairedPrinters()))}
            />
            {paired.map((p) => (
              <ListRow
                key={p.address}
                title={p.name}
                subtitle={p.address}
                trailing={config.address === p.address ? 'Selected' : undefined}
                onPress={() => setConfig((c) => ({ ...c, address: p.address, name: p.name }))}
              />
            ))}
            {config.address && <Copy muted>Selected: {config.name ?? config.address}</Copy>}
          </>
        )}
        {config.transport === 'network' && (
          <>
            <Field
              label="Printer IP address or hostname"
              value={config.address}
              onChangeText={(address) => setConfig((c) => ({ ...c, address }))}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="192.168.1.100"
            />
            <Field
              label="TCP port"
              value={port}
              onChangeText={setPort}
              keyboardType="number-pad"
              maxLength={5}
            />
          </>
        )}
        <AppButton
          theme={theme}
          label="Save printer"
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              await savePrinterConfig(current);
              setMessage('Printer saved. Use a test print to check the connection.');
            })
          }
        />
        <AppButton
          theme={theme}
          variant="secondary"
          label="Print test receipt"
          disabled={action.busy}
          onPress={() =>
            action.run(async () => {
              await savePrinterConfig(current);
              await printReceipt(
                {
                  saleId: 'test',
                  saleNumber: 'TEST PRINT',
                  date: new Date().toLocaleString(),
                  customerName: 'Test customer',
                  paymentSummary: 'Cash',
                  businessName: 'MOPX printer test',
                  currencyCode: currency.code,
                  subtotal: 10,
                  discount: 0,
                  tax: 0,
                  total: 10,
                  paid: 10,
                  due: 0,
                  change: 0,
                  items: [
                    {
                      name: 'Sample product',
                      unit: 'piece',
                      quantity: 1,
                      unitPrice: 10,
                      discount: 0,
                      tax: 0,
                      total: 10,
                    },
                  ],
                  footerMessage: 'Connection test — no sale was recorded.',
                },
                current
              );
              setMessage('Print data sent. Confirm the paper output on your printer.');
            })
          }
        />
      </Panel>
    </AppScreen>
  );
}
