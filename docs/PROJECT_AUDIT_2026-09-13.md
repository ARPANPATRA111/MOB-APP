# MOPX project audit — 13 September 2026

MOPX has a useful offline POS foundation, but several current workflows can lose work, overwrite stock, or present misleading information. The best next investment is recovery, data correctness, bounded database queries, and consistent screen state. Keep the existing visual direction and improve the daily workflow incrementally.

This audit identifies work; it does not implement production changes.

## Scope and evidence

Reviewed the application shell, all screen workflows, domain modules, repositories, SQLite schema/migrations, legacy migration, export/backup, shared UI, Android/EAS configuration, dependency tree, tests, and existing project documentation. Inspected three supplied Play Store artwork screenshots: dashboard, billing, and reports. Those are archived marketing assets, not screenshots of a newly tested build.

Executed `npm run verify`, `npm run test:stress`, `npm audit --json`, and dependency-tree inspection. Also executed application TypeScript against **Node's real, in-memory SQLite** with an adapter for the repository executor and mocked Expo/AsyncStorage boundaries. Synthetic fixtures and injected failures were used; no shop database or emulator data was modified.

An Android emulator was connected, but `com.arpanpatra.mopx` was not installed. No current-build device walkthrough, native transaction/concurrency test, FPS measurement, APK signature verification, or physical-camera test was performed. The in-memory harness establishes SQL and workflow behavior; it does not establish Android performance or Expo's connection behavior.

Evidence labels:

- **Reproduced:** executed the relevant source against synthetic inputs or SQLite.
- **Code-confirmed:** the implementation establishes the behavior, but the UI sequence was not exercised on a current device build.
- **Needs measurement/verification:** plausible risk with a specific test required.

## What the project is trying to do

The intended user is a small retailer operating one shop from one phone. The primary loop is **add/restock products → scan/search → review cart and payment → save sale → reduce stock → issue receipt → review sales and low stock**. Settings provides business details, currency, appearance, exports, and OTA update checks.

The current architecture is broadly appropriate:

| Layer | Purpose | Assessment |
| --- | --- | --- |
| `screens/`, shared UI, contexts | Shop workflows and presentation | Clear visual direction, but screen state is fragmented and several screens remain large |
| `src/domain` | Money, stock, cart, reports, barcode, formatting rules | Useful separation and unit coverage; validation differs between entry paths |
| `src/repositories` | SQLite reads/writes | Parameterized SQL; sales are transactional, other business mutations often are not |
| `src/db` | Schema, migrations, database lifecycle | Additive migrations, WAL, and migration metadata are good choices |
| `src/services/storage.ts` | Compatibility/orchestration adapter | Still exposes full inventory snapshots and lossy legacy bill shapes to current workflows |
| Native/EAS configuration | Android packaging and OTA updates | Needs release checks, supported dependencies, and explicit config ownership |

There is no business backend, account system, payment gateway, or multi-device sync. Recording “UPI” or “Card” records the operator's choice; it does not verify settlement. Tables named `operators`/`customers` and `sync_status` columns do not mean those features exist. Plan/usage-limit helpers are not a complete monetization workflow.

Preserve the existing strengths: local-first operation, sale/item/payment/movement/audit writes in one sale transaction, integer minor-unit storage, historical item-name/price snapshots, parameterized SQL, HTML escaping in receipts/reports, legacy AsyncStorage preservation, camera/manual lookup options, light/dark themes, and reduced-motion support in splash/skeleton/toast components.

## Highest-priority repairs

### A01 — Stale inventory snapshots can overwrite newer business data

**Priority: immediate. Reproduced.**

Inventory mounts once and keeps a local array. Product deletion calls `saveInventory(updatedInventory)`, which upserts every surviving product and soft-deletes every database product absent from that array. Add Item and CSV import also use this snapshot API.

Reproduction: load A=10 and B=10; sell two A; add C; delete B using the original array. A returns from **8 to 10**, and newly added C becomes hidden. This does not require simultaneous operators; navigating between mounted screens is enough to create a stale snapshot.

**Fix:** replace live snapshot writes with narrow commands: create product, edit metadata, restock by delta, adjust counted stock with expected version, and soft-delete selected IDs. Execute each command transactionally. Refresh/invalidate affected reads after commit. Reserve snapshot replacement for an explicit, reviewed restore operation.

Sources: [InventoryScreen](../screens/InventoryScreen.tsx), `saveInventory`, `deleteItem`, `bulkDeleteItems`; [storage service](../src/services/storage.ts), `saveInventory`; [product repository](../src/repositories/productRepository.ts), `replaceInventorySnapshot`.

### A02 — Product and stock mutations can partially commit

**Priority: immediate. Reproduced.**

`createStockMovement` updates quantity before inserting the movement without owning a transaction. Product creation similarly inserts the product and initial movement separately. Editing metadata and adjusting stock are separate operations.

Injected a failure at the movement insert: the function failed, but stock remained **13 instead of 10**, with no corresponding movement for that change.

**Fix:** own transactions at the use-case boundary and pass the transaction executor to every participating repository. Validate first; commit metadata, stock, movement, and audit together. Use guarded updates/version checks so a stale quantity edit is rejected explicitly. Make restock a positive delta with a restock movement, rather than an unexplained inventory edit.

Sources: [inventory repository](../src/repositories/inventoryRepository.ts), `createStockMovement`, `adjustStockWithReason`; [product repository](../src/repositories/productRepository.ts), `createProduct`, `updateProduct`; [storage service](../src/services/storage.ts), `updateInventoryItem`.

### A03 — Sold-out legacy products can block migration/startup

**Priority: immediate. Reproduced.**

Legacy normalization accepts quantity **0** and price **0**, but migration then calls current product creation, which requires positive quantity and positive price. A synthetic legacy inventory containing one sold-out product failed initialization with “Quantity must be a positive integer.” The migration transaction rolls back; original AsyncStorage remains intact.

There is a second recovery gap: malformed legacy JSON can be replaced with an empty fallback, errors recorded, and migration marked complete without a user review. The recorded “pre-migration” snapshot contains normalized data, not the original raw values, although the originals remain in AsyncStorage.

**Fix:** define explicit migration validation separately from new-product entry; preserve legitimate zero-stock records and historical pricing. Quarantine unconvertible records with a visible recovery summary. Do not silently mark an unresolved import fully complete. Preserve raw source values and support an idempotent, reviewed retry.

Sources: [legacy migration](../src/services/legacyAsyncStorageMigration.ts), `normalizeLegacyInventory`, `safeParseJson`, `migrateLegacyAsyncStorage`; [validation](../src/domain/validation.ts), `validateProductInput`.

### A04 — The exported backup is incomplete and cannot currently be restored through the app

**Priority: immediate before relying on the app for sole-copy records. Reproduced/code-confirmed.**

The backup exports legacy inventory and bill objects, categories, removed barcodes, and theme. It omits business profile/currency settings, stock movement history, audit history, per-product thresholds, and full sale/payment detail. Product image paths are included, but the actual files are not. Legacy bills lose bill-level discount/tax breakdown and payment splits/references. Reads are not grouped into a consistent snapshot transaction.

There is validation but no implemented restore workflow. Settings currently promises **“JSON restores everything”**, which the code does not support. Android's main manifest disables automatic backup, increasing the importance of tested manual recovery.

**Fix:** correct the promise, define a complete versioned backup format, include image assets and all required business records, produce a consistent snapshot, and implement restore into a staging database. Validate counts, references, amounts, supported schema, available disk space, and file sizes before an atomic switch. Preserve the previous database and test export → fresh installation → restore → reconciliation.

Sources: [storage service](../src/services/storage.ts), `BackupSnapshot`, `buildBackupSnapshot`; [sale repository](../src/repositories/saleRepository.ts), `toLegacyBill`; [Settings](../screens/SettingsScreen.tsx), backup section; [manifest validation](../src/domain/backupManifest.ts).

### A05 — Checkout and review have inconsistent cart state

**Priority: high. Code-confirmed.**

Billing and Bill Review each initialize their own React cart from the module-level `billingSession`. Review writes its changes to the session, but the already-mounted Billing screen does not read those changes on return. Editing/removing an item in Review → Add more → Review again can restore the older cart. Customer/payment/discount fields also reset when Review remounts. The draft exists only in memory and is cleared by New Bill.

**Fix:** one observable checkout state for the entire flow, with a SQLite draft for process-death recovery. Save cart and checkout metadata together. Offer explicit resume/discard behavior. After successful checkout, ensure navigation cannot expose the completed cart again.

Sources: [Billing](../screens/BillingScreen.tsx), cart initializer and `reviewBill`; [Bill Review](../screens/BillReviewScreen.tsx), initializer and `updateCart`; [billing session](../src/services/billingSession.ts).

### A06 — Customer phone is collected but not saved

**Priority: high. Reproduced.**

Bill Review passes `customerPhone` to `storageService.createBill`; the adapter omits it when calling `createSaleTransaction`. A synthetic sale with a phone came back with `customerPhone: null`. Existing receipt tests construct a sale with a phone directly and therefore miss the adapter bug. Legacy bill normalization also drops a source phone.

**Fix:** preserve the field across both boundaries and add a service-to-repository-to-receipt regression test.

Source: [storage service](../src/services/storage.ts), `createBill`; [legacy migration](../src/services/legacyAsyncStorageMigration.ts), `normalizeLegacyBills`.

### A07 — Deleting a product prevents normal re-addition of its barcode

**Priority: high. Reproduced.**

Soft-deleted products retain a globally unique barcode. Creation only checks active records, then tries to insert another row. Re-addition fails with `UNIQUE constraint failed: products.barcode`. IDs are also derived from the barcode, so merely changing the barcode index is insufficient.

The ID normalization additionally collapses distinct custom codes: both `ABC_123` and `ABC-123` produce `product-abc-123` (reproduced). That can cause primary-key conflicts for otherwise different products or legacy records. Category IDs use the same normalization pattern.

**Fix:** use an explicit restore-product operation when the same product returns, preserving historical identity. If reusing a barcode for a genuinely different product is required, introduce independent product IDs and a deliberate active-barcode uniqueness policy through a non-destructive migration.

Sources: [initial schema](../src/db/migrations/001_initial_schema.ts); [product repository](../src/repositories/productRepository.ts), `createProduct`, `softDeleteProduct`.

### A08 — Startup failure and screen errors do not have reliable recovery

**Priority: high. Code-confirmed.**

Database, migration, and data-layer initialization promises retain rejection. AppShell dismisses the splash even on initialization failure. Dashboard initial/focus loads have no catch; activity and notifications use `finally` without a catch. Async failures do not automatically reach a React render error boundary. Some screens consequently stay loading, show an empty state, or produce an unhandled rejection. ErrorBoundary's retry only remounts children; it does not clear failed initialization state.

**Fix:** explicit initialization states, a visible retry/recovery screen, and safe reset of failed initialization attempts. Give each query loading/error/empty/success states, retain known-good data with an error indicator, and provide a real retry action. Preserve the database throughout recovery.

Sources: [App](../App.tsx), `AppShell`; [database](../src/db/database.ts); [migration runner](../src/db/migrate.ts); [storage service](../src/services/storage.ts); [ErrorBoundary](../ErrorBoundary.tsx); dashboard/activity/notifications loaders.

## Reporting and billing correctness

| ID / priority | Finding and evidence | Concrete repair |
| --- | --- | --- |
| A09 / High | Reports and Inventory load on mount/range changes, not on return after a sale or product edit. Reports has no pull-to-refresh. **Code-confirmed.** | Invalidate queries after committed mutations; refresh on focus/resume/day change; show last successful update time. |
| A10 / High | While a report range is loading, old data remains but the new `label` is already used for cards and PDF export. A failed load can leave old numbers under the new period indefinitely. **Code-confirmed.** | Treat data and its resolved range as one immutable result. Disable export during mismatched/loading state or export the old result with its old range explicitly. |
| A11 / Medium, latent API bug | `getSalesSummary` joins sales to items and sums the sale total once per item row. Reproduced **5,000 expected cents versus 8,000 actual cents** across two synthetic sales. No current screen calls this helper. | Aggregate sales totals and item quantities separately before combining. Add a multi-line-sale SQL regression test before using this helper for dashboard optimization. |
| A12 / Medium | Trend keys contain day/month but no year, merging different years. Reproduced two January 1 sales from separate years as one point. Localized display labels are parsed back into dates for sorting, and zero-sale days are missing. | Group/sort by full local business date, format only at display time, and fill missing dates with zero. |
| A13 / Medium, latent weekly API bug | Weekly calculation anchored on 1 Sep 2026 returned **30 Aug–6 Oct**, instead of **30 Aug–5 Sep**. Current quick ranges use another function and are not affected by this specific bug. Custom UI also accepts start after end. | Derive end from the adjusted start; use half-open ranges internally; validate custom boundaries and test month/year/time-zone transitions. |
| A14 / High for misleading history | Currency and business identity are read from the current profile, not snapshotted on the sale. Changing INR to USD relabels old amounts without conversion; reprinted seller details can also change. **Code-confirmed.** | Snapshot currency and relevant seller/tax details on sale creation; restrict currency changes once trading starts or create an explicit new ledger. Do not invent historical conversions. |
| A15 / High for checkout UX | Negative discount input can throw during render; an excessive discount is clamped to zero total and Create Bill silently returns. General money functions accept invalid/non-integer/non-finite discount cases. `toCents('1.005')` produced 100. **Reproduced/code-confirmed.** | Strict decimal parsing and minor-unit validation; reject excessive discounts with inline errors; define precision/rounding limits; keep unvalidated input out of render-time calculations. Add safe-integer limits and database constraints through migration. |
| A16 / Medium | Tax is a hardcoded 5% toggle. “Mixed” creates one payment labeled Mixed, without the cash/card/UPI amounts. Product revenue uses line totals before bill-level tax/discount adjustments, so it need not reconcile to the headline. | Configurable tax treatment, real split-payment allocation, cash received/change, and clearly named gross/net/tax/discount measures with reconciliation rules. This is a product/data recommendation, not a certification of tax compliance. |
| A17 / Medium | The submit guard relies on React state, and every attempt generates a new timestamp ID. A repeat attempt after an ambiguous completion has no durable idempotency key. **Hardening gap; duplicate sale not device-reproduced.** | Persist one checkout ID per draft; use a synchronous in-flight guard and a unique database key that returns the existing committed sale on retry. |

Sources: [Reports](../screens/ReportsScreen.tsx), `loadReport`, `sharePdf`; [report domain](../src/domain/reports.ts); [sale repository](../src/repositories/saleRepository.ts); [receipt domain](../src/domain/receipt.ts); [currency context](../src/contexts/CurrencyContext.tsx); [Bill Review](../screens/BillReviewScreen.tsx); [money](../src/domain/money.ts); [payment](../src/domain/payment.ts).

Reporting improvements should answer operational questions. Current screens show sales, item counts, payments, trends, top sellers, and present-day low stock. They do not yet provide profit, purchase cost, expenses, refunds, supplier balances, inventory valuation, or a reconciled day close. Current low stock should be labeled **“Current stock”** when shown beside historical sales. It should remain visible even if the selected period has no sales. “In stock” currently excludes low-stock products because it uses `quantity > 5`; the label or filter needs correction. Per-product thresholds are stored but lost in the legacy inventory DTO, while Inventory hardcodes five.

## Security and release review

The largest app-level exposure is access to the unlocked phone and its exports. I did not establish a remotely exploitable takeover or a production credential leak. Reviewed SQL binds user values, receipt/report HTML escapes text, no business-data network API was found, and the main Android manifest disables automatic backup and removes microphone/overlay permissions. These observations do not replace analysis of a shipped binary.

| ID / priority | Finding | Repair and verification |
| --- | --- | --- |
| S01 / High if distributed this way | Local Gradle `release` explicitly uses the bundled debug signing key. EAS production references local credentials; the actual EAS/shipped signature was not examined. | Separate local test builds from signed releases, fail a production build if release credentials are missing, verify APK/AAB certificate fingerprints, and keep the private key outside Git. See [Android app signing](https://developer.android.com/studio/publish/app-signing). |
| S02 / High dependency maintenance | `npm audit` reports **31 affected package entries: 11 high, 20 moderate, 0 critical**. These are not 31 distinct demonstrated app exploits. Metro/image-size and XML/YAML tooling account for substantial development/build exposure. `decode-uri-component` and `nanoid` are also in React Navigation's dependency tree. | Apply compatible Expo patches, trace each advisory to the actual call path, update supported transitive dependencies, rebuild and test. Do not run `npm audit fix --force`: current suggestions include incompatible downgrades. Do not repeat older docs' claim that all findings are dev-only. |
| S03 / Medium, confirmed unsafe export | CSV quotes fields but leaves formula-leading strings intact. Synthetic product name `=1+1` was exported as `"=1+1"`. Spreadsheet interpretation is the attack boundary, not SQL. | Prefer text-typed spreadsheet cells for human-facing export, or a tested spreadsheet-safe CSV mode separate from import data. Test formula/control-character prefixes and escaping; quoting alone is insufficient. [OWASP CSV injection](https://owasp.org/www-community/attacks/CSV_Injection). |
| S04 / Medium, local privacy | No app PIN/biometric lock, no SQLCipher setup, and JSON exports are plaintext. OS app isolation still applies; ordinary apps do not thereby gain database access. Anyone with an unlocked session can view/export shop data. | Add optional local lock and export reauthentication; offer authenticated encrypted backups with a recovery plan. If the threat model warrants database encryption, use a maintained SQLCipher integration and OS-protected keys, not custom field encryption. [Expo SQLite configuration](https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/). |
| S05 / Medium before restore/import exposure | Backup validation accepts malformed rows and unsupported schema versions; checksum absence is only a warning. A fake schema 9999 backup with an invalid inventory row was accepted. FNV checksum detects some corruption, not authenticity. | Strict structural/version/size/referential validation; never use checksum as authorization. Use authenticated encryption for secure backups and reject unsupported formats before any writes. No current restore entry point was found. |
| S06 / Medium hardening | Product delete passes stored `imageUri` straight to file deletion before database success; image filenames incorporate raw custom barcodes. Cleanup's ownership restriction is not used by the screen delete path. | Generate opaque image IDs, validate/canonicalize app-owned paths, commit record changes before cleanup, and preserve files referenced by retained products/backups. Imported/legacy URIs must not be trusted as deletion authority. |
| S07 / Medium release reliability | OTA is enabled with fixed runtime `2.0.0`; no end-to-end update signing configuration is present. Account/HTTPS trust remains relevant; missing extra signing is not proof of interception. | Verify runtime compatibility whenever native code changes, test preview updates and rollback against migrated data, protect publishing credentials, and evaluate update code signing. [Expo update signing](https://docs.expo.dev/eas-update/code-signing/). |

Dependency details from the installed tree: Metro uses `image-size@1.2.1`; navigation uses `decode-uri-component@0.2.2` through `query-string@7.1.3`, and `nanoid@3.3.17`. Representative current references: [image-size advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [decode-uri-component advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr). No app linking configuration or malicious navigation-input route was established, so the latter's runtime exploitability remains unproven.

Native configuration is maintained in `android/` and `app.json`, with Expo's synchronization check disabled. Permission removals and `allowBackup=false` exist in the checked-in manifest but are not all explicitly reproduced in plugin configuration. Choose one documented source of truth or create a config plugin for intentional native edits; inspect the **merged release manifest** after regeneration. Do not blindly regenerate the native project during dependency repair.

The privacy policy's absolute “business/customer data never leaves your device” wording conflicts with user-initiated PDF/JSON/CSV sharing. Clarify automatic network behavior versus explicit sharing and describe plaintext exports accurately. This is a factual product-documentation issue; legal compliance was not assessed.

Sources: [Gradle app config](../android/app/build.gradle), release signing block; [main manifest](../android/app/src/main/AndroidManifest.xml); [app config](../app.json); [package config](../package.json); [CSV](../src/domain/backup.ts); [backup validation](../src/domain/backupManifest.ts); [Inventory](../screens/InventoryScreen.tsx), `deleteItem`; [Add Item](../screens/AddItemScreen.tsx), `saveImageToStorage`; [privacy policy](PRIVACY_POLICY.md).

## Optimization plan, in descending order of payoff

### 1. Stop reading every sale and every product for summary screens

`listSalesByDateRange` performs one list query, then three more queries per sale: sale header, items, payments. The harness measured **7 queries for 2 sales**. By inspection, 10,000 sales requires 30,001 queries on this path, excluding other screen reads. Dashboard calls the unbounded history path on entry/focus just to show recent bills and seven days of totals. Activity loads all detailed bills to display a short row. Reports hydrate all sales in the chosen range.

**Change:** create dashboard/report read repositories with SQL aggregates and bounded recent-sale/header queries. Load receipt items only when opening a receipt. Batch related item/payment reads where full detail is genuinely needed. Group sale, item, and payment aggregates independently to avoid A11's join multiplication. Measure query count, returned rows, allocation, and total latency.

### 2. Make pagination happen in SQLite

Inventory's 40-row pagination only slices an already-loaded, searched, and sorted JavaScript array. Add Item reads the whole inventory for barcode lookup and again during save. Billing's name search is `%query%`, which is not a prefix index lookup. It limits before filtering out-of-stock products, so an initial page can omit available matches further down the result set. Main Billing search also lacks a stale-response guard; the picker has one.

**Change:** database-side filters/sort and stable keyset pagination, indexed exact barcode lookup, availability filtering before LIMIT, and a consistent search contract. Profile SQL query plans; choose indexes that match active/date/name filters. Consider FTS only after defining required matching behavior. Cancel/ignore obsolete search responses and expose “more results.” Do not solve full-catalog loading by merely swapping list libraries.

### 3. Correct camera lifecycle and scan feedback

Billing keeps `CameraView` mounted and uses `active={scannerActive}`. In this installed Expo API, **`active` is iOS-only**; Android native code exposes pause/resume preview instead. Disabling scan callbacks does not establish that the Android camera session stops. Add Item uses a similar prop. Battery/heat/resource impact needs measurement on the actual app.

**Change:** unmount the camera when its screen loses focus; manage overlay/background pause explicitly with the supported platform lifecycle. Track application foreground state, and pause while camera-owning workflows are obscured. Expo recommends unmounting an unfocused camera. [Expo Camera documentation](https://docs.expo.dev/versions/v55.0.0/sdk/camera/).

`scanBarcode` awaits the beep before lookup and beeps even for unknown products. Its 700 ms repeat guard allows a stationary barcode to increment repeatedly after the interval. Define an intentional repeated-scan policy and show success feedback only after a successful addition. Preload audio independently of product loading. Replace `expo-av`, which is excluded from doctor checks but still used in both camera screens; Expo says it is no longer receiving patches and was removed from SDK 55 Expo Go. [SDK 55 release notes](https://expo.dev/changelog/sdk-55).

### 4. Profile transitions, then reduce work during navigation

The app uses `@react-navigation/stack`. Evaluate `@react-navigation/native-stack` for task transitions; native transitions avoid dependence on JavaScript frame delivery. This is a candidate improvement, not a measured speedup for MOPX. React Native recommends measuring release builds and explains the 16.67 ms frame budget at 60 Hz. [React Native performance](https://reactnative.dev/docs/performance).

Keep the current native-driver opacity/translation animations and reduced-motion support. Move nonessential loading/formatting away from transition start, prevent duplicate initial loads, memoize expensive rows/selectors, and keep scanner/cart subtrees independent. Several screens recreate styles on every render, but fixing that is lower priority than eliminating thousands of queries. The Review FlatList has scrolling disabled inside a ScrollView, so large carts lose useful virtualization; use one scrolling list with header/footer content.

Use a small consistent motion vocabulary: immediate press feedback, short interruptible modal/toast transitions, stable content during refresh, and minimal layout movement. Extending animation duration or adding a heavier chart library will not resolve blocked work.

### 5. Bound image/export memory and disk use

Images are resized to 800 px but have no separate list thumbnail. Copy/compression failure can fall back to temporary URIs. Single deletion removes an image before database success; bulk deletion leaves files behind. The orphan-cleanup utility is not wired into a workflow. JSON/CSV serialization builds complete strings in memory; exported files have no explicit retention lifecycle.

**Change:** durable original/thumbnail paths with generated IDs, atomic image replacement, bounded cache, post-commit cleanup with reference checks, and export progress/cancellation. For larger stores use streaming/chunked logical exports or a supported SQLite backup mechanism that accounts for WAL and sidecar files. Do not copy only a live main `.db` file as a shortcut.

Suggested **acceptance targets**, to establish on a chosen budget Android release build, are: visible tap response within 100 ms; p95 barcode lookup/cart update within 150 ms after decode; p95 catalog search within 250 ms; p95 30-day summary within 1 second for an agreed dataset; no growing memory trend over a 30-minute billing session. These are proposed targets, not measured results. Record device/OS, build, warm/cold conditions, row counts, image counts, and p50/p95 rather than a single best run. Measure dropped frames and transition traces separately from data latency.

## UI/UX changes that would help daily use

The existing cards, readable totals, restrained colors, and prominent billing action are worth keeping. Archived artwork supports that visual assessment, but does not validate current hit areas, keyboard behavior, or frame smoothness.

- **Checkout:** preserve the draft through every back/forward path; show quantity and total units separately from distinct products; make removal undoable; keep total and primary action visible above the keyboard.
- **Touch/accessibility:** Review's quantity/delete controls are 32×32 with no expanded hit areas. Target at least 48×48 on Android, add explicit labels/selected states to icon controls and payment options, persistent input labels, screen-reader feedback, and large-font layouts. Test 320–360 dp widths and 200% text scaling.
- **Scanner:** let the operator collapse the camera to prioritize the cart; add a torch option, clear scan target, and recovery for denied permissions. Request photos/camera access when the corresponding action needs it rather than presenting multiple permissions immediately on Add Item.
- **Product entry:** distinguish “Create product,” “Restock,” and “Adjust count”; show the resulting stock before saving. Support manual/custom codes with an appropriate keyboard; current number-pad entry conflicts with documented custom codes. “Price (Rs.)” remains hardcoded in Add Item despite currency settings.
- **Inventory:** current data on return, product-level threshold editing, explain active filters, open an alert's specific product, and restore soft-deleted products. Make categories editable through a clear management workflow.
- **Reports:** put sales/net totals, payments, and actions first; allow product/payment/day drill-down to the matching receipts; explicitly label current stock; include comparison periods and export a resolved, dated snapshot.
- **Layout/copy:** the report export footer and tab bar occupy substantial space; verify the layout against current native tab-height behavior, especially with large text. Replace implementation language such as “Persisted sale items,” “Lightweight chart from saved bills,” and preference-storage explanations with shop language.
- **Settings:** put business profile, receipts, backup/recovery, and appearance before developer information; move developer details into About/Help. Show last successful backup and a restore action once restore is actually implemented.
- **Feedback:** Inventory's save helper swallows errors, after which delete handlers still show success and clear selection. Propagate failures and show success only after commit. Queue dialogs or explicitly settle the previous one; DialogProvider currently overwrites a single pending resolver. Use one shared scanner/toast policy and test rapid successive feedback. Respect reduced motion in modal transitions too.

## Useful new functions, after the repairs

These are candidates in practical priority order, not a request to add all of them at once:

1. **Complete backup and restore:** encrypted portable backup, restore preview, image recovery, reminders, and an observable last-successful-backup status.
2. **Park/resume bills:** durable drafts, quick switching, and safe recovery after app termination.
3. **Returns, refunds, and voids:** reference the original sale and create compensating payment/stock records with reasons; never erase the original transaction.
4. **Day closing:** opening cash, cash sales, refunds, expenses, expected cash, counted cash, and variance.
5. **Purchases and suppliers:** goods received, purchase cost, supplier reference, restock history, and replenishment list.
6. **Profit and inventory reporting:** cost snapshots/costing policy first, then gross profit, margin, stock valuation, slow movers, and stock discrepancy reporting. Selling price alone cannot produce reliable profit.
7. **Payment usability:** real split payments, cash tendered/change, reference capture, and explicit operator-confirmed settlement state.
8. **Product flexibility:** internal SKUs for unbarcoded items, units/pack sizes, fractional quantities where needed, per-product tax/threshold settings, and robust CSV import preview with row errors.
9. **Receipt productivity:** receipt search/reprint/share, configurable layout, and thermal-printer support after device testing.
10. **Optional customer ledger:** customer history, credit/due balances, settlement records, and consent-conscious contact capture.
11. **Local protection:** optional PIN/biometric lock and sensitive-action confirmation. Staff permissions would require a separate approved scope.

Cloud sync, backend authentication, payment gateways, multi-store operations, and staff/enterprise features remain later, explicitly approved projects. Keep them out of the reliability repair phase. Good local identifiers, immutable events, and migrations will make a later sync design easier without building it now.

## Delivery sequence and proof of completion

| Stage | Work | Required evidence before progressing |
| --- | --- | --- |
| 1 — Protect stock and recovery | A01–A08; input errors; backup wording; complete backup/restore design; compatible dependency/release repairs | Stale-screen, zero-stock legacy, failed-write, re-add, cart-return, phone, and retry regressions; original data preserved |
| 2 — Trustworthy, fast reads | SQL dashboard/report aggregates, paging, report invalidation, resolved-range export, currency snapshots | Multi-line reconciliation, month/year boundaries, query-count budgets, export correctness, and real SQLite tests |
| 3 — Daily interaction | Camera lifecycle/audio, checkout layout/accessibility, native-transition evaluation, row/image work | Current release build on emulator and physical budget Android; keyboard/back/permissions/large text; frame/memory measurements |
| 4 — Management workflows | Returns, day close, purchases/costs, report drill-down, optional customer ledger | Transactional compensating records and reconciled reports; usable end-to-end shop scenarios |

Before changing critical production workflows, write the regression tests required by AGENTS.md. Add a repeatable real SQLite harness alongside the existing fakes, including failing writes after sale/item/payment/movement inserts. Test duplicate checkout IDs and concurrent stock writes on native Expo SQLite. Verify `PRAGMA foreign_keys` for transaction connections: the installed Expo implementation creates a new connection for exclusive transactions, while the app sets the pragma on its original connection. Enforcement on that separate native connection was **not verified** in this audit. Apply connection initialization before transaction begin where needed. Remove the silent non-transactional fallback for executors used for production mutations.

Add a repository CI workflow (none was present under `.github/workflows`) for typecheck, lint, tests, Expo compatibility, and an Android bundle/build smoke check. Add advisory triage and secret scanning. Test migrations from actual historical fixtures, interrupted migration, corrupt/partial backups, disk-full behavior, process death, repeated scans, permission denial, and reinstall/restore. Do not interpret existing test counts as business-path coverage.

## Check results

| Check | Result |
| --- | --- |
| TypeScript | Passed as part of `npm run verify` |
| ESLint | Passed as part of `npm run verify` |
| Unit/repository-fake tests | **17 suites, 77 tests passed** |
| Expo doctor | **18/19 passed; failed SDK package compatibility**, with 14 packages behind expected patch versions; native config synchronization check disabled |
| Overall `npm run verify` | **Failed** because doctor failed |
| Stress utilities | **4 tests passed**: 5,000-product CSV ≈16 ms; 2,000-sale in-memory report aggregation ≈99 ms; 5,000-product search ≈3 ms; dashboard/scanner utility scenario ≈2 ms |
| Dependency audit | **11 high, 20 moderate, 0 critical** affected package entries |
| Audit SQLite harness | Reproduced stale snapshot overwrite/hiding, incomplete stock mutation, phone loss, re-add conflict, summary join error, 1+3N reads, zero-stock legacy failure; migration rerun skipped all 3 already-applied migrations and invalid-payment sale rolled back |
| Audit pure-function cases | Reproduced cross-year trend merging, weekly boundary error, invalid backup acceptance, formula-bearing CSV, broken multiline CSV round-trip, and money-validation edge cases |
| Device/UI performance | **Not measured**; archived artwork and source inspection only |

The stress suite operates on JavaScript fixtures and allows up to five seconds per case. It does not include SQLite hydration, the React Native bridge, screen rendering, camera decoding, PDF generation, native storage latency, or realistic device memory. The 99 ms report calculation is evidence that even the aggregation portion deserves a frame-budget review; it is not an Android benchmark.

The CSV multiline round-trip also demonstrates a data-import defect separate from formula injection: an exported product named `First\nSecond` parsed into an incorrect product with barcode `Second`. Replace the regex/line-split parser with an RFC-compatible parser, validate headers and every row, report rejected rows, and apply imports transactionally. This path is presently a service API without an import-picker UI.

Existing roadmap/hardening/README statements have drifted: older vulnerability counts, test counts, blanket “indexed search” claims, and “no chart analytics” wording no longer describe the current source consistently. Update those after implementing repairs, using measured results and explicit feature status.

**Repository change from this audit:** this report only. No production source, dependencies, migrations, user data, Git history, release credentials, or deployment was changed.
