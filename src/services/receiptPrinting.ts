import { PermissionsAndroid, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { createReceiptHtml, type ReceiptData } from '../domain/receipt';
import { formatCurrency } from '../domain/currency';
import { getSetting, setSetting } from '../repositories/settingsRepository';
import { retailNative } from './retailNative';
export interface PrinterConfig {
  transport: 'system' | 'bluetooth' | 'network';
  address: string;
  port: number;
  width: 384 | 576;
  name?: string;
}
export const getPrinterConfig = () =>
  getSetting<PrinterConfig>('printer', {
    transport: 'system',
    address: '',
    port: 9100,
    width: 384,
  });
export const savePrinterConfig = async (config: PrinterConfig) => {
  if (
    !['system', 'bluetooth', 'network'].includes(config.transport) ||
    ![384, 576].includes(config.width)
  )
    throw new Error('Choose a valid printer type and paper width');
  if (
    config.transport === 'network' &&
    (!/^[a-zA-Z0-9.:-]{1,253}$/.test(config.address) ||
      !Number.isInteger(config.port) ||
      config.port < 1 ||
      config.port > 65535)
  )
    throw new Error('Enter the printer host and a port between 1 and 65535');
  if (config.transport === 'bluetooth' && !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(config.address))
    throw new Error('Choose a paired Bluetooth printer');
  await setSetting('printer', config);
};
export const requestPrinterPermission = async () => {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED)
      throw new Error('Allow Nearby devices access to use a Bluetooth printer.');
  }
};
export const getPairedPrinters = async () => {
  await requestPrinterPermission();
  return retailNative().pairedPrinters();
};
export const receiptText = (receipt: ReceiptData) => {
  const money = (n: number) => formatCurrency(n, receipt.currencyCode);
  const separator = '--------------------------------';
  return [
    receipt.businessName,
    receipt.businessAddress,
    receipt.businessPhone,
    receipt.gstin ? `GSTIN: ${receipt.gstin}` : null,
    separator,
    receipt.saleNumber,
    receipt.date,
    `Customer: ${receipt.customerName}`,
    receipt.customerPhone,
    separator,
    ...receipt.items.flatMap((i) => [
      i.name,
      `${i.quantity} ${i.unit ?? ''} x ${money(i.unitPrice)}`,
      `Line total: ${money(i.total)}`,
    ]),
    separator,
    `Subtotal: ${money(receipt.subtotal)}`,
    `Bill discount: ${money(receipt.discount)}`,
    `Tax: ${money(receipt.tax)}`,
    `TOTAL: ${money(receipt.total)}`,
    `Paid: ${money(receipt.paid ?? receipt.total)}`,
    `Balance: ${money(receipt.due ?? 0)}`,
    `Change: ${money(receipt.change ?? 0)}`,
    receipt.dueDate ? `Due: ${receipt.dueDate}` : null,
    separator,
    ...(receipt.payments ?? []).map(
      (p) => `${p.method} ${money(p.amount)}\n${p.date}${p.reference ? ' · ' + p.reference : ''}`
    ),
    separator,
    receipt.footerMessage,
  ]
    .filter((v) => v != null && v !== '')
    .join('\n');
};
export const printReceipt = async (receipt: ReceiptData, override?: PrinterConfig) => {
  const config = override ?? (await getPrinterConfig());
  if (config.transport === 'system') {
    await Print.printAsync({ html: createReceiptHtml(receipt) });
    return;
  }
  if (config.transport === 'bluetooth') await requestPrinterPermission();
  const image = await retailNative().renderReceipt(receiptText(receipt), config.width);
  try {
    await retailNative().printReceipt(config.transport, config.address, config.port, image);
  } finally {
    if (image.startsWith(FileSystem.cacheDirectory + 'receipt-'))
      await FileSystem.deleteAsync(image, { idempotent: true }).catch(() => {});
  }
};
