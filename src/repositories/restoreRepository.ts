import { inTransaction, type DbExecutor } from '../db/database';

import { BACKUP_TABLES, type BackupManifest } from '../domain/fullBackupManifest';

// Copy records into the app's trusted schema. Never install SQL schema supplied by a file.

const insertOrder = [
  'schema_migrations',
  'business_profiles',
  'operators',
  'categories',
  'products',
  'customers',
  'sales',
  'sale_items',
  'inventory_movements',
  'payments',
  'app_settings',
  'audit_logs',
  'backup_exports',
  'suppliers',
  'purchases',
  'purchase_items',
  'bill_drafts',
  'import_runs',
] as const;

type Column = { name: string; type: string; pk: number; hidden?: number };

export const validateRestoreDatabase = async (
  source: DbExecutor,
  target: DbExecutor,
  manifest: BackupManifest
) => {
  await source.execAsync('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');

  const integrity = await source.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check'
  );

  if (
    integrity?.integrity_check !== 'ok' ||
    (await source.getAllAsync('PRAGMA foreign_key_check')).length
  )
    throw new Error('Backup database integrity check failed');

  const tables = await source.getAllAsync<{ name: string; type: string; sql: string }>(
    "SELECT name,type,sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'"
  );

  if (
    tables.length !== BACKUP_TABLES.length ||
    tables.some(
      (t) =>
        t.type !== 'table' ||
        !BACKUP_TABLES.includes(t.name as never) ||
        !/^CREATE TABLE\s/i.test(t.sql)
    )
  )
    throw new Error('Unsupported backup database schema');

  const sourceMigrations = await source.getAllAsync<{ id: string }>(
    'SELECT id FROM schema_migrations ORDER BY id'
  );

  const targetMigrations = await target.getAllAsync<{ id: string }>(
    'SELECT id FROM schema_migrations ORDER BY id'
  );

  if (JSON.stringify(sourceMigrations) !== JSON.stringify(targetMigrations))
    throw new Error('Backup migrations do not match this app');

  const columns: Record<string, string[]> = {};

  for (const table of BACKUP_TABLES) {
    const expected = await target.getAllAsync<Column>(`PRAGMA table_xinfo(${table})`);

    const actual = await source.getAllAsync<Column>(`PRAGMA table_xinfo(${table})`);

    const signature = (list: Column[]) =>
      JSON.stringify(
        list
          .map((c) => [c.name, c.type, c.pk, c.hidden ?? 0])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      );

    if (signature(expected) !== signature(actual))
      throw new Error(`Backup table ${table} is incompatible`);

    const count = await source.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);

    if (count?.n !== manifest.counts[table])
      throw new Error(`Backup record count does not match: ${table}`);

    columns[table] = expected.map((c) => c.name);
  }

  const invalidProduct = await source.getFirstAsync(
    `SELECT id FROM products WHERE stock_quantity<0 OR price_cents<0 OR low_stock_threshold<0 OR cost_cents<0 OR unit NOT IN ('piece','pack','box','kg','g','litre','ml','metre') OR typeof(price_cents)<>'integer' LIMIT 1`
  );

  const invalidSale = await source.getFirstAsync(
    `SELECT id FROM sales WHERE total_cents<0 OR subtotal_cents<0 OR discount_cents<0 OR tax_cents<0 OR total_cents<>subtotal_cents-discount_cents+tax_cents LIMIT 1`
  );

  const invalidPayment = await source.getFirstAsync(
    `SELECT s.id FROM sales s JOIN payments p ON p.sale_id=s.id GROUP BY s.id HAVING SUM(p.amount_cents)>s.total_cents OR MIN(p.amount_cents)<0 LIMIT 1`
  );

  if (invalidProduct || invalidSale || invalidPayment)
    throw new Error('Backup contains invalid stock or payment amounts');

  return columns;
};

export const restoreRecords = async (
  source: DbExecutor,
  target: DbExecutor,
  manifest: BackupManifest,
  imageUris: Map<string, string>,
  beforeCommit?: () => void
) => {
  const columns = await validateRestoreDatabase(source, target, manifest);

  await inTransaction(async (txn) => {
    for (const table of [...insertOrder].reverse()) await txn.runAsync(`DELETE FROM ${table}`);

    for (const table of insertOrder) {
      const names = columns[table];
      let cursor:number|null=null;
      let copied=0;

      while (true) {
        const rows = await source.getAllAsync<Record<string, string | number | null>>(
          `SELECT rowid AS __backup_rowid,${names.map((n) => `"${n}"`).join(',')} FROM ${table}${cursor===null?'':' WHERE rowid>?'} ORDER BY rowid LIMIT 250`,
          cursor===null?[]:[cursor]
        );

        for (const row of rows) {
          // Only remap known file references; never rewrite arbitrary notes or audit text.

          for (const key of ['image_uri', 'logo_uri'])
            if (typeof row[key] === 'string' && imageUris.has(row[key] as string))
              row[key] = imageUris.get(row[key] as string)!;

          if (table === 'sales' && row.seller_json) {
            const seller = JSON.parse(String(row.seller_json));
            if (seller?.logoUri && imageUris.has(seller.logoUri)) {
              seller.logoUri = imageUris.get(seller.logoUri);
              row.seller_json = JSON.stringify(seller);
            }
          }

          if (table === 'bill_drafts') {
            const draft = JSON.parse(String(row.payload_json));
            if (!Array.isArray(draft.cart)) throw new Error('Invalid draft in backup');
            draft.cart = draft.cart.map((item: Record<string, unknown>) => ({
              ...item,
              image:
                typeof item.image === 'string'
                  ? (imageUris.get(item.image) ?? item.image)
                  : undefined,
            }));
            row.payload_json = JSON.stringify(draft);
          }

          if (table === 'app_settings' && row.key === 'businessProfileExtras') {
            const extras = JSON.parse(String(row.value));
            if (extras?.logoUri && imageUris.has(extras.logoUri)) {
              extras.logoUri = imageUris.get(extras.logoUri);
              row.value = JSON.stringify(extras);
            }
          }

        }
        const batchSize=Math.max(1,Math.floor(900/names.length));
        for(let offset=0;offset<rows.length;offset+=batchSize){
          const batch=rows.slice(offset,offset+batchSize);
          await txn.runAsync(`INSERT INTO ${table}(${names.map(n=>`"${n}"`).join(',')}) VALUES ${batch.map(()=>`(${names.map(()=>'?').join(',')})`).join(',')}`,batch.flatMap(row=>names.map(n=>row[n])));
        }
        copied+=rows.length;
        if(rows.length<250)break;
        cursor=Number(rows[rows.length-1].__backup_rowid);
        if(!Number.isSafeInteger(cursor))throw new Error('Backup has an invalid record position');
      }
      if(copied!==manifest.counts[table])throw new Error(`Not all ${table} records were restored`);
    }

    beforeCommit?.();

    if ((await txn.getAllAsync('PRAGMA foreign_key_check')).length)
      throw new Error('Restored data has invalid references');
  }, target);
};
