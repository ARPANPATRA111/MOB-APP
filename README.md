# MOPX - Retail POS & Inventory

MOPX is an offline-first retail POS and inventory app for small vendors, shopkeepers, kiosks, and local retailers. It is built with React Native and Expo and focuses on practical store workflows: product entry, barcode-assisted lookup, inventory, billing, receipts, reports, theme preference, and local backup/export.

This repository is being modernized from a graduation-project codebase into a production-quality offline POS foundation. The revamp is intentionally phased: stabilize the repo first, modernize the local data layer, improve billing correctness, then redesign the core POS workflow.

## Current Status

Implemented in the current revamp:

- Expo SDK dependency alignment.
- Basic lint, test, typecheck, doctor, and verify scripts.
- Truthful documentation and revamp roadmap.
- SQLite local database foundation through `expo-sqlite`.
- Idempotent database migrations.
- Legacy AsyncStorage business-data migration.
- Repository layer for products, categories, inventory, sales, settings, and migration metadata.
- Transactional sale creation that writes sale, sale items, payment, audit log, and stock movements atomically.
- Domain modules for cart totals, payment validation, receipt formatting, reports, CSV export, and inventory rules.
- SQLite-backed receipts and reports.
- Production-oriented redesign for Dashboard, Billing, Receipt, Reports, Settings, and key Inventory interactions.
- Business profile on receipts.
- PDF receipt/report export, JSON backup export, and product CSV export.
- Stock adjustment reason capture for inventory quantity edits.

Not implemented yet:

- AES encryption for transactions.
- Chart-based analytics.
- 98 percent test coverage.
- Cloud sync, backend, authentication, payment gateway, multi-user mode, or web dashboard.
- CSV import picker UI, backup restore UI, WhatsApp-specific receipt flow, item-level discount UI, PIN lock, and multi-operator workflows.

## Target Users

- Small grocery and retail shops.
- Local vendors and pop-up sellers.
- Kiosk operators.
- Solo shopkeepers who need billing and stock tracking without depending on internet access.

## Tech Stack

- Expo SDK 55
- React Native 0.83
- React 19
- TypeScript
- React Navigation stack
- Expo Camera for barcode scanning
- Expo Print and Sharing for receipt/report export
- Expo SQLite for business data
- AsyncStorage only for lightweight preferences and migration compatibility
- Jest for unit tests
- Expo ESLint config

## Storage Direction

The legacy app stored products, bills, categories, and other business data in AsyncStorage JSON arrays. That was useful for a student project but is not a production POS database.

The revamp uses SQLite as the primary local business database. AsyncStorage may remain for lightweight preferences such as theme, onboarding flags, and migration markers. Legacy AsyncStorage data is preserved and imported into SQLite during migration.

## Install

```bash
npm install
```

## Run

```bash
npm start
npm run android
npm run ios
npm run web
```

## Local Android APK

This repo now includes a generated `android/` project for local Gradle builds. After changing native app config in `app.json`, rerun:

```bash
npx expo prebuild --platform android
```

Then build locally with:

```bash
.\android\gradlew.bat -p android assembleDebug
.\android\gradlew.bat -p android assembleRelease
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run doctor
npm run verify
```

## Revamp Roadmap

1. Phase 0 - Repo stabilization and truthful baseline.
2. Phase 1 - SQLite data layer modernization.
3. Phase 2 - Billing and inventory correctness.
4. Phase 3 - Production POS UI/UX redesign.
5. Phase 4 - Offline MVP production features.
6. Phase 5 - Future expansion planning only.

## Known Limitations

- Some screens still use the `storageService` compatibility adapter while the data layer transition is completed.
- Product add/edit still needs a full shared UI-kit pass.
- CSV import and restore logic need a file-picker review flow before they are exposed in the UI.
- Customer phone is collected in Billing but deeper customer management is not implemented yet.
- No cloud backup or multi-device sync exists yet.
- No authentication, role system, or local encryption exists yet.

## Manual Smoke Checklist

After a data-layer change, test:

```text
open app
add product
search product
scan or manually enter barcode
create bill
verify stock decreases
open receipt
open reports
restart app
verify data persists
```
