# Migration Plan

## Legacy Source

Known AsyncStorage keys:

- `inventory`
- `bills`
- `categories`
- `removedBarcodes`
- `themePreference`

## Migration Steps

1. Run SQLite schema migrations.
2. Check whether legacy migration is already complete.
3. Read known legacy keys.
4. Parse JSON safely.
5. Validate inventory and bill rows.
6. Create a backup snapshot in `backup_exports`.
7. Import categories.
8. Import products with current stock.
9. Import historical bills.
10. Preserve removed barcode list as an app setting.
11. Mark migration complete only after inserts finish.
12. Keep original AsyncStorage data untouched.

## Failure Behavior

- Invalid JSON is recorded as an error.
- Invalid rows are skipped and reported.
- Original data is not deleted.
- Migration can safely run again; completion flag prevents duplicates.
