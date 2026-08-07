# Data Model

## Implemented Tables

- `schema_migrations`
- `business_profiles`
- `operators`
- `categories`
- `products`
- `customers`
- `sales`
- `sale_items`
- `inventory_movements`
- `payments`
- `app_settings`
- `audit_logs`
- `backup_exports`

## Important Relationships

- `products.category_id -> categories.id`
- `sales.customer_id -> customers.id`
- `sale_items.sale_id -> sales.id`
- `sale_items.product_id -> products.id`
- `inventory_movements.product_id -> products.id`
- `payments.sale_id -> sales.id`

## Offline-First Fields

Core business entities include stable string IDs, timestamps, `deleted_at`, `sync_status`, and `version` where useful. These fields prepare the local model for future sync without implementing cloud sync now.

## Indexes

- Product barcode.
- Product name.
- Product category.
- Sale date.
- Sale item product.
- Inventory movement product.

## Migration Note

Legacy AsyncStorage inventory is imported as current product stock. Legacy sales are imported as historical sale records without replaying stock deductions.
