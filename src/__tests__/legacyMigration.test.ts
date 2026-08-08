/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../db/migrate', () => ({
  runMigrations: jest.fn(),
}));

jest.mock('../db/database', () => ({
  getDatabase: jest.fn(),
  executeExclusive: jest.fn(),
}));

import {
  normalizeLegacyBills,
  normalizeLegacyInventory,
} from '../services/legacyAsyncStorageMigration';

describe('legacy AsyncStorage migration parsing', () => {
  it('normalizes valid legacy inventory rows', () => {
    const errors: string[] = [];
    const rows = normalizeLegacyInventory(
      [
        {
          barcode: ' 123 ',
          name: 'Tea',
          quantity: 3,
          price: 25.5,
          category: 'Grocery',
        },
      ],
      errors
    );

    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        barcode: '123',
        name: 'Tea',
        quantity: 3,
        price: 25.5,
        category: 'Grocery',
        imageUri: undefined,
      },
    ]);
  });

  it('skips corrupt inventory rows with errors', () => {
    const errors: string[] = [];
    const rows = normalizeLegacyInventory(
      [{ barcode: '', name: '', quantity: -1, price: 'bad' }],
      errors
    );

    expect(rows).toEqual([]);
    expect(errors[0]).toContain('invalid');
  });

  it('normalizes valid legacy bills', () => {
    const errors: string[] = [];
    const rows = normalizeLegacyBills(
      [
        {
          id: 'BILL-1',
          customerName: 'Asha',
          timestamp: 1000,
          paymentMethod: 'UPI',
          total: 40,
          items: [
            {
              id: '123',
              name: 'Tea',
              quantity: 2,
              price: 20,
              total: 40,
            },
          ],
        },
      ],
      errors
    );

    expect(errors).toEqual([]);
    expect(rows[0].id).toBe('BILL-1');
    expect(rows[0].items[0].quantity).toBe(2);
  });

  it('skips corrupt bills without dropping the whole payload', () => {
    const errors: string[] = [];
    const rows = normalizeLegacyBills(
      [
        { id: '', items: [] },
        {
          id: 'BILL-2',
          timestamp: 2000,
          total: 10,
          items: [{ id: '1', name: 'Pen', quantity: 1, price: 10, total: 10 }],
        },
      ],
      errors
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('BILL-2');
    expect(errors.length).toBeGreaterThan(0);
  });
});
