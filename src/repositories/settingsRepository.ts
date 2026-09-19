import { getDatabase, inTransaction, type DbExecutor } from '../db/database';
import { createLocalId, nowIso, SYNC_STATUS_PENDING } from '../db/schema';

const dbOrDefault = async (db?: DbExecutor) => db ?? (await getDatabase());

export const getSetting = async <T = unknown>(
  key: string,

  fallback: T,

  db?: DbExecutor
): Promise<T> => {
  const database = await dbOrDefault(db);

  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',

    [key]
  );

  if (!row) {
    return fallback;
  }

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
};

export const setSetting = async (
  key: string,

  value: unknown,

  db?: DbExecutor
): Promise<void> =>
  inTransaction(async (database) => {
    const now = nowIso();

    await database.runAsync(
      `INSERT INTO app_settings (key, value, created_at, updated_at)

      VALUES (?, ?, ?, ?)

      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,

      [key, JSON.stringify(value), now, now]
    );
  }, db);

export interface BusinessProfile {
  id: string;

  businessName: string;

  ownerName?: string | null;

  phone?: string | null;

  email?: string | null;

  address?: string | null;

  logoUri?: string | null;

  taxLabel?: string | null;

  gstin?: string | null;

  receiptFooter?: string | null;

  currencyCode: string;
}

interface BusinessProfileRow {
  id: string;

  business_name: string;

  owner_name: string | null;

  phone: string | null;

  email: string | null;

  address: string | null;

  logo_uri: string | null;

  tax_label: string | null;

  currency_code: string;
}

const toProfile = (row: BusinessProfileRow): BusinessProfile => ({
  id: row.id,

  businessName: row.business_name,

  ownerName: row.owner_name,

  phone: row.phone,

  email: row.email,

  address: row.address,

  logoUri: row.logo_uri,

  taxLabel: row.tax_label,

  currencyCode: row.currency_code,
});

export const getBusinessProfileSettings = async (db?: DbExecutor) => {
  return getSetting<Partial<BusinessProfile>>('businessProfileExtras', {}, db);
};

export const getBusinessProfile = async (db?: DbExecutor): Promise<BusinessProfile | null> => {
  const database = await dbOrDefault(db);

  const row = await database.getFirstAsync<BusinessProfileRow>(
    'SELECT * FROM business_profiles WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1'
  );

  if (!row) {
    const extras = await getBusinessProfileSettings(database);

    return extras.businessName
      ? {
          id: 'business-local',

          businessName: extras.businessName,

          ownerName: extras.ownerName ?? null,

          phone: extras.phone ?? null,

          email: extras.email ?? null,

          address: extras.address ?? null,

          logoUri: extras.logoUri ?? null,

          taxLabel: extras.taxLabel ?? null,

          gstin: extras.gstin ?? null,

          receiptFooter: extras.receiptFooter ?? null,

          currencyCode: extras.currencyCode ?? 'INR',
        }
      : null;
  }

  const extras = await getBusinessProfileSettings(database);

  return {
    ...toProfile(row),

    gstin: extras.gstin ?? null,

    receiptFooter: extras.receiptFooter ?? null,
  };
};

export const updateBusinessProfile = async (
  updates: Partial<Omit<BusinessProfile, 'id'>>,

  db?: DbExecutor
): Promise<BusinessProfile> =>
  inTransaction(async (database) => {
    const existing = await getBusinessProfile(database);
    if (updates.currencyCode && updates.currencyCode !== (existing?.currencyCode ?? 'INR')) {
      const activity = await database.getFirstAsync<{ n: number }>(
        'SELECT (SELECT COUNT(*) FROM sales)+(SELECT COUNT(*) FROM purchases) AS n'
      );
      if (activity?.n)
        throw new Error(
          'Currency cannot change after sales or purchases. Existing amounts are recorded in the store currency.'
        );
    }
    const now = nowIso();

    const id = existing?.id ?? createLocalId('business');

    await database.runAsync(
      `INSERT INTO business_profiles (

      id, business_name, owner_name, phone, email, address, logo_uri, tax_label,

      currency_code, created_at, updated_at, sync_status, version

    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)

    ON CONFLICT(id) DO UPDATE SET

      business_name = excluded.business_name,

      owner_name = excluded.owner_name,

      phone = excluded.phone,

      email = excluded.email,

      address = excluded.address,

      logo_uri = excluded.logo_uri,

      tax_label = excluded.tax_label,

      currency_code = excluded.currency_code,

      updated_at = excluded.updated_at,

      sync_status = excluded.sync_status,

      version = business_profiles.version + 1`,

      [
        id,

        updates.businessName ?? existing?.businessName ?? '',

        updates.ownerName ?? existing?.ownerName ?? null,

        updates.phone ?? existing?.phone ?? null,

        updates.email ?? existing?.email ?? null,

        updates.address ?? existing?.address ?? null,

        updates.logoUri ?? existing?.logoUri ?? null,

        updates.taxLabel ?? existing?.taxLabel ?? null,

        updates.currencyCode ?? existing?.currencyCode ?? 'INR',

        now,

        now,

        SYNC_STATUS_PENDING,
      ]
    );

    await setSetting(
      'businessProfileExtras',

      {
        businessName: updates.businessName ?? existing?.businessName ?? '',

        ownerName: updates.ownerName ?? existing?.ownerName ?? null,

        phone: updates.phone ?? existing?.phone ?? null,

        email: updates.email ?? existing?.email ?? null,

        address: updates.address ?? existing?.address ?? null,

        logoUri: updates.logoUri ?? existing?.logoUri ?? null,

        taxLabel: updates.taxLabel ?? existing?.taxLabel ?? null,

        gstin: updates.gstin ?? existing?.gstin ?? null,

        receiptFooter: updates.receiptFooter ?? existing?.receiptFooter ?? null,

        currencyCode: updates.currencyCode ?? existing?.currencyCode ?? 'INR',
      },

      database
    );

    const profile = await getBusinessProfile(database);

    if (!profile) {
      throw new Error('Failed to update business profile');
    }

    return profile;
  }, db);
