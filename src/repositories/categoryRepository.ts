import { getDatabase, type DbExecutor } from '../db/database';
import { createStableLegacyId, nowIso, SYNC_STATUS_PENDING } from '../db/schema';

export interface CategoryRecord {
  id: string;
  name: string;
  color?: string | null;
  sortOrder: number;
  deletedAt?: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  deleted_at: string | null;
}

const toRecord = (row: CategoryRow): CategoryRecord => ({
  id: row.id,
  name: row.name,
  color: row.color,
  sortOrder: row.sort_order,
  deletedAt: row.deleted_at,
});

const dbOrDefault = async (db?: DbExecutor) => db ?? (await getDatabase());

export const createCategory = async (
  name: string,
  db?: DbExecutor
): Promise<CategoryRecord> => {
  const database = await dbOrDefault(db);
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Category name is required');
  }

  const now = nowIso();
  const id = createStableLegacyId('category', trimmedName);
  await database.runAsync(
    `INSERT INTO categories (
      id, name, color, sort_order, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, NULL, 0, ?, ?, ?, 1)
    ON CONFLICT(name) DO UPDATE SET
      deleted_at = NULL,
      updated_at = excluded.updated_at,
      sync_status = excluded.sync_status,
      version = categories.version + 1`,
    [id, trimmedName, now, now, SYNC_STATUS_PENDING]
  );

  const category = await database.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE name = ?',
    [trimmedName]
  );
  if (!category) {
    throw new Error('Failed to create category');
  }

  return toRecord(category);
};

export const listCategories = async (db?: DbExecutor): Promise<CategoryRecord[]> => {
  const database = await dbOrDefault(db);
  const rows = await database.getAllAsync<CategoryRow>(
    'SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order, name'
  );
  return rows.map(toRecord);
};

export const updateCategory = async (
  id: string,
  updates: { name?: string; color?: string | null; sortOrder?: number },
  db?: DbExecutor
): Promise<void> => {
  const database = await dbOrDefault(db);
  const current = await database.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  if (!current) {
    throw new Error('Category not found');
  }

  await database.runAsync(
    `UPDATE categories
      SET name = ?, color = ?, sort_order = ?, updated_at = ?, sync_status = ?, version = version + 1
      WHERE id = ?`,
    [
      updates.name?.trim() || current.name,
      updates.color ?? current.color,
      updates.sortOrder ?? current.sort_order,
      nowIso(),
      SYNC_STATUS_PENDING,
      id,
    ]
  );
};

export const softDeleteCategory = async (id: string, db?: DbExecutor): Promise<void> => {
  const database = await dbOrDefault(db);
  await database.runAsync(
    `UPDATE categories
      SET deleted_at = ?, updated_at = ?, sync_status = ?, version = version + 1
      WHERE id = ?`,
    [nowIso(), nowIso(), SYNC_STATUS_PENDING, id]
  );
};

export const replaceCategoriesByName = async (
  names: string[],
  db?: DbExecutor
): Promise<void> => {
  const database = await dbOrDefault(db);
  const normalizedNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const current = await listCategories(database);

  for (const name of normalizedNames) {
    await createCategory(name, database);
  }

  for (const category of current) {
    if (!normalizedNames.includes(category.name)) {
      await softDeleteCategory(category.id, database);
    }
  }
};

export const getCategoryByName = async (
  name: string,
  db?: DbExecutor
): Promise<CategoryRecord | null> => {
  const database = await dbOrDefault(db);
  const row = await database.getFirstAsync<CategoryRow>(
    'SELECT * FROM categories WHERE name = ? AND deleted_at IS NULL',
    [name.trim()]
  );
  return row ? toRecord(row) : null;
};

export const ensureCategoryByName = async (
  name?: string,
  db?: DbExecutor
): Promise<CategoryRecord | null> => {
  if (!name?.trim()) {
    return null;
  }

  const existing = await getCategoryByName(name, db);
  return existing ?? createCategory(name, db);
};
