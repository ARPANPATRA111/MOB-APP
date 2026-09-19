import { getDatabase, inTransaction, type DbExecutor } from '../db/database';
import { createLocalId, nowIso } from '../db/schema';
import { assertMinorUnits, quantityCostCents, validateQuantity, weightedAverageCost } from '../domain/commerce';
import { getProductById } from './productRepository';
import { createStockMovement } from './inventoryRepository';
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
}
export const listSuppliers = async (db?: DbExecutor): Promise<Supplier[]> =>
  (db ?? (await getDatabase())).getAllAsync<Supplier>(
    'SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY name LIMIT 500'
  );
export const saveSupplier = async (
  input: Partial<Supplier> & { name: string },
  db?: DbExecutor
): Promise<string> =>
  inTransaction(async (txn) => {
    if (!input.name.trim() || input.name.length > 200)
      throw new Error('Enter a supplier name (up to 200 characters)');
    const id = input.id ?? createLocalId('supplier');
    const now = nowIso();
    await txn.runAsync(
      `INSERT INTO suppliers(id,name,phone,address,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,phone=excluded.phone,address=excluded.address,notes=excluded.notes,updated_at=excluded.updated_at`,
      [
        id,
        input.name.trim(),
        input.phone?.trim() ?? '',
        input.address?.trim() ?? '',
        input.notes?.trim() ?? '',
        now,
        now,
      ]
    );
    return id;
  }, db);
export interface PurchaseInput {
  id: string;
  supplierId?: string;
  reference?: string;
  date: number;
  notes?: string;
  items: { productId: string; quantity: number; unitCostCents: number }[];
}
export const createPurchase = async (input: PurchaseInput, db?: DbExecutor): Promise<string> =>
  inTransaction(async (txn) => {
    if (await txn.getFirstAsync('SELECT id FROM purchases WHERE id=?', [input.id])) return input.id;
    if (!input.items.length || input.items.length > 200)
      throw new Error('Add between 1 and 200 purchase lines');
    if (!Number.isSafeInteger(input.date) || input.date < 0)
      throw new Error('Invalid purchase date');
    const supplier = input.supplierId
      ? await txn.getFirstAsync<Supplier>(
          'SELECT * FROM suppliers WHERE id=? AND deleted_at IS NULL',
          [input.supplierId]
        )
      : null;
    if (input.supplierId && !supplier) throw new Error('Supplier not found');
    const lines = [];
    const seen = new Set<string>();
    for (const item of input.items) {
      if (seen.has(item.productId)) throw new Error('Combine duplicate purchase lines');
      seen.add(item.productId);
      const p = await getProductById(item.productId, txn);
      if (!p) throw new Error('Product not found');
      validateQuantity(item.quantity, p.unit);
      assertMinorUnits(item.unitCostCents, 'Cost');
      lines.push({
        ...item,
        p,
        total: quantityCostCents(item.quantity, item.unitCostCents),
      });
    }
    const total = assertMinorUnits(lines.reduce((sum, l) => sum + l.total, 0));
    const now = nowIso();
    await txn.runAsync(
      'INSERT INTO purchases(id,supplier_id,supplier_name,reference,purchase_date,total_cents,notes,created_at) VALUES(?,?,?,?,?,?,?,?)',
      [
        input.id,
        supplier?.id ?? null,
        supplier?.name ?? 'Direct restock',
        input.reference?.trim() ?? '',
        input.date,
        total,
        input.notes?.trim() ?? '',
        now,
      ]
    );
    for (const line of lines) {
      const cost = weightedAverageCost(
        line.p.stockQuantity,
        line.p.costCents,
        line.quantity,
        line.unitCostCents
      );
      await txn.runAsync('UPDATE products SET cost_cents=? WHERE id=?', [cost, line.p.id]);
      await createStockMovement(
        {
          productId: line.p.id,
          quantityDelta: line.quantity,
          movementType: 'restock',
          reason: input.reference?.trim() || 'Purchase received',
          referenceType: 'purchase',
          referenceId: input.id,
        },
        txn
      );
      await txn.runAsync(
        'INSERT INTO purchase_items(id,purchase_id,product_id,product_name,quantity,unit,unit_cost_cents,total_cents) VALUES(?,?,?,?,?,?,?,?)',
        [
          createLocalId('purchase-line'),
          input.id,
          line.p.id,
          line.p.name,
          line.quantity,
          line.p.unit,
          line.unitCostCents,
          line.total,
        ]
      );
    }
    await txn.runAsync(
      `INSERT INTO audit_logs(id,entity_type,entity_id,action,message,created_at) VALUES(?,'purchase',?,'create','Purchase received',?)`,
      [createLocalId('audit'), input.id, now]
    );
    return input.id;
  }, db);
export interface PurchaseHeader {
  id: string;
  supplier_name: string;
  reference: string;
  purchase_date: number;
  total_cents: number;
  notes: string;
}
export const listPurchases = async (db?: DbExecutor): Promise<PurchaseHeader[]> =>
  (db ?? (await getDatabase())).getAllAsync<PurchaseHeader>(
    'SELECT * FROM purchases ORDER BY purchase_date DESC LIMIT 100'
  );
export const getPurchaseItems = async (id: string, db?: DbExecutor) =>
  (db ?? (await getDatabase())).getAllAsync<{
    product_name: string;
    quantity: number;
    unit: string;
    unit_cost_cents: number;
    total_cents: number;
  }>('SELECT * FROM purchase_items WHERE purchase_id=?', [id]);
