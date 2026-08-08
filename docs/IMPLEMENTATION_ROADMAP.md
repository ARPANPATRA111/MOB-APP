# Implementation Roadmap

## Phase 0 - Repo Stabilization

Status: implemented in this pass.

- Align Expo package versions.
- Add lint/test/verify scripts.
- Make README truthful.
- Add project guidance docs.

## Phase 1 - SQLite Data Layer

Status: implemented as a foundation in this pass.

- Add Expo SQLite.
- Add schema and migrations.
- Add repositories.
- Add legacy AsyncStorage migration.
- Route existing storage compatibility service to SQLite for business data.
- Switch billing payment completion to transactional sale creation.

## Phase 2 - Billing And Inventory Correctness

Status: implemented as the current correctness layer.

- Cart quantity, discount, tax, and total calculations live in `src/domain`.
- Billing creates saved sales through the transactional sale repository.
- Receipts load saved SQLite sales by ID before rendering or sharing.
- Reports are generated from persisted SQLite sales, not screen-local bill math.
- Inventory quantity edits create stock adjustment movements with a reason.
- Duplicate-submit protection is present in the billing submit flow.

## Phase 3 - Production UI

Status: implemented for the core POS surfaces.

- Dashboard was redesigned around today sales, recent sales, low stock, and quick actions.
- Billing was redesigned around fast search, scanner/manual barcode fallback, cart totals, discount, tax toggle, and payment mode.
- Receipt was redesigned as a saved-sale receipt with PDF sharing.
- Reports now show period filters, product movement, payment mode summary, and low-stock context.
- Settings now includes business profile, theme, JSON backup, CSV product export, and storage/sync status.
- Inventory now has search, category chips, low-stock visual treatment, edit/delete, and stock adjustment reason capture.

## Phase 4 - Offline MVP Features

Status: partially implemented.

- Business profile appears on receipts.
- PDF receipt sharing is available through Expo Print and Sharing.
- JSON backup export is available from Settings.
- Product CSV export is available from Settings.
- Low-stock indicators are shown on Dashboard, Reports, and Inventory.
- Stock adjustment with reason is available from Inventory edit.
- Daily/period summaries are available from Reports.
- Customer name/phone, payment modes, tax toggle, and bill-level discount are available in Billing.
- Pending: CSV import picker UI, restore UI, item-level discount UI, WhatsApp-specific receipt flow, daily closing handoff screen, and PIN lock.

## Current Hardening Pass

- Shared safe-area-aware `AppScreen` and bottom action bar.
- Compact scanner billing flow with cart validation visible during scanning.
- Official-style invoice HTML generated from persisted sale data.
- Advanced reports with preset/custom ranges, payment breakdown, product bars, trend bars, and low-stock insight.
- Developer info in Settings.
- Separate stress tests and performance/limits documentation.
- Local Gradle APK generation remains the build path; EAS is not used.

## Phase 5 - Future Planning

Planning only unless explicitly approved.

- Cloud backup and multi-device sync.
- Conflict resolution for future sync.
- Multi-user roles and operator PIN policies.
- Web dashboard.
- Supplier, customer, expense, analytics, GST, and localization expansion.

## Compatibility Notes

Existing screens still call `storageService`. That service now routes products, categories, sales, and stock to SQLite. Theme remains AsyncStorage-backed.

The app intentionally keeps this adapter during the revamp so UI changes can remain reviewable while the data layer is productionized.
