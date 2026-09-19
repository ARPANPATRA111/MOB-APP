import { getDatabase, inTransaction, type DbExecutor } from '../db/database';
import { nowIso } from '../db/schema';
import type { CartItem } from '../domain/cart';
export interface CheckoutDraft {
  id: string;
  cart: CartItem[];
  customerId?: string;
  customerName: string;
  customerPhone: string;
  discount: string;
  taxPercent: string;
  allowCredit: boolean;
  dueDate?: number;
  cash: string;
  upi: string;
  card: string;
  label: string;
}
export interface DraftRow {
  id: string;
  label: string;
  payload_json: string;
  state: string;
  updated_at: string;
}
export const saveDraft = async (
  draft: CheckoutDraft,
  state = 'active',
  db?: DbExecutor
): Promise<void> =>
  inTransaction(async (txn) => {
    if (await txn.getFirstAsync('SELECT id FROM sales WHERE id=?', [draft.id])) return;
    const now = nowIso();
    await txn.runAsync(
      `INSERT INTO bill_drafts(id,label,payload_json,state,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,payload_json=excluded.payload_json,state=excluded.state,updated_at=excluded.updated_at,version=bill_drafts.version+1`,
      [
        draft.id,
        draft.label || draft.customerName || 'Walk-in bill',
        JSON.stringify(draft),
        state,
        now,
        now,
      ]
    );
  }, db);
export const listDrafts = async (db?: DbExecutor): Promise<DraftRow[]> =>
  (db ?? (await getDatabase())).getAllAsync<DraftRow>(
    'SELECT * FROM bill_drafts ORDER BY updated_at DESC LIMIT 100'
  );
export const deleteDraft = async (id: string, db?: DbExecutor): Promise<void> =>
  inTransaction(async (txn) => {
    await txn.runAsync('DELETE FROM bill_drafts WHERE id=?', [id]);
  }, db);
