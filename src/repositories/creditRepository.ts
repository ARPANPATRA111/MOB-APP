import { getDatabase, inTransaction, type DbExecutor } from '../db/database';
import { createLocalId, nowIso } from '../db/schema';
import { assertMinorUnits } from '../domain/commerce';
export interface CreditBill {
  id: string;
  sale_number: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string;
  total_cents: number;
  paid_cents: number;
  due_cents: number;
  due_date: number | null;
  sale_date: number;
  currency_code: string;
}
export const listCreditBills = async (query = '', db?: DbExecutor): Promise<CreditBill[]> => {
  const like = '%' + query.trim().replace(/[\\%_]/g, '\\$&') + '%';
  return (db ?? (await getDatabase())).getAllAsync<CreditBill>(
    `SELECT * FROM (SELECT s.*, COALESCE((SELECT SUM(amount_cents) FROM payments WHERE sale_id=s.id),0) AS paid_cents, s.total_cents-COALESCE((SELECT SUM(amount_cents) FROM payments WHERE sale_id=s.id),0) AS due_cents FROM sales s WHERE s.deleted_at IS NULL) WHERE due_cents>0 AND (customer_name LIKE ? ESCAPE '\\' OR COALESCE(customer_phone,'') LIKE ? ESCAPE '\\') ORDER BY COALESCE(due_date,9223372036854775807),sale_date LIMIT 100`,
    [like, like]
  );
};
export const getCreditSummary = async (db?: DbExecutor) =>
  (db ?? (await getDatabase())).getFirstAsync<{
    due_cents: number;
    overdue_cents: number;
    count: number;
  }>(
    `SELECT COALESCE(SUM(due),0) AS due_cents, COALESCE(SUM(CASE WHEN due_date < ? THEN due ELSE 0 END),0) AS overdue_cents, COUNT(*) AS count FROM (SELECT due_date,total_cents-COALESCE((SELECT SUM(amount_cents) FROM payments WHERE sale_id=s.id),0) AS due FROM sales s WHERE deleted_at IS NULL) WHERE due>0`,
    [Date.now()]
  );
export const recordInstallment = async (
  input: { id: string; saleId: string; amountCents: number; method: string; reference?: string },
  db?: DbExecutor
): Promise<void> =>
  inTransaction(async (txn) => {
    assertMinorUnits(input.amountCents);
    if (input.amountCents <= 0 || !['Cash', 'UPI', 'Card', 'Bank'].includes(input.method))
      throw new Error('Enter a positive amount and valid payment method');
    const previous = await txn.getFirstAsync<{ sale_id: string; amount_cents: number }>(
      'SELECT sale_id,amount_cents FROM payments WHERE id=?',
      [input.id]
    );
    if (previous) {
      if (previous.sale_id !== input.saleId || previous.amount_cents !== input.amountCents)
        throw new Error('Payment reference was already used');
      return;
    }
    const sale = await txn.getFirstAsync<{ total_cents: number; paid: number }>(
      `SELECT total_cents,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE sale_id=s.id),0) AS paid FROM sales s WHERE id=? AND deleted_at IS NULL`,
      [input.saleId]
    );
    if (!sale) throw new Error('Sale not found');
    if (input.amountCents > sale.total_cents - sale.paid)
      throw new Error('Payment exceeds the remaining balance. Refresh this bill.');
    const now = nowIso();
    await txn.runAsync(
      'INSERT INTO payments(id,sale_id,method,amount_cents,reference,paid_at,tendered_cents,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
      [
        input.id,
        input.saleId,
        input.method,
        input.amountCents,
        input.reference?.trim() ?? null,
        Date.now(),
        input.amountCents,
        now,
        now,
      ]
    );
    await txn.runAsync(
      'UPDATE sales SET payment_status=?,updated_at=?,version=version+1 WHERE id=?',
      [sale.paid + input.amountCents === sale.total_cents ? 'paid' : 'partial', now, input.saleId]
    );
    await txn.runAsync(
      `INSERT INTO audit_logs(id,entity_type,entity_id,action,message,metadata_json,created_at) VALUES(?,'payment',?,'installment','Credit payment received',?,?)`,
      [
        createLocalId('audit'),
        input.id,
        JSON.stringify({ saleId: input.saleId, amountCents: input.amountCents }),
        now,
      ]
    );
  }, db);
export const searchCustomers = async (query = '', db?: DbExecutor) =>
  (db ?? (await getDatabase())).getAllAsync<{ id: string; name: string; phone: string }>(
    'SELECT id,name,phone FROM customers WHERE deleted_at IS NULL AND (name LIKE ? OR phone LIKE ?) ORDER BY name LIMIT 30',
    [query.trim() + '%', query.trim() + '%']
  );
