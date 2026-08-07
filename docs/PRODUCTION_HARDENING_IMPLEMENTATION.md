# MOPX — Production-Hardening Implementation Tracking

Living checklist for the phase-gated production-hardening pass. Updated after every phase.

## Non-negotiable execution rules

- **Keep `android/`.** Do not delete or git-ignore it. Do not switch fully to managed workflow. Do not run `expo prebuild --clean`.
- **No EAS builds, no AAB, no cloud quota, no keystore creation/modification** this pass. Local Android Studio + Gradle only.
- **Finish with locally-built `app-debug.apk` + `app-release.apk`** via `android/gradlew`.
- **Do not change the Android package/application ID** (`com.arpanpatra.mobapp`).
- EAS / OTA / AAB / Play-signing = **documented future work only**.
- **Worktree safety:** no `git reset`/`clean`/rebase/force; no commit/push; no branch create/switch while untracked work exists. Inspect every already-modified file before editing. Verify stale line numbers against current files.
- **Phase gates:** don't advance if typecheck/lint/unit/migration/report tests fail, billing breaks, app can't bundle, or a native build regression appears. Mark device-only work `Code complete — physical-device QA pending` (never "verified" without a device).

### Barcode compatibility rule
- Camera product-scanning default formats: **EAN-13, EAN-8, UPC-A, UPC-E**.
- **QR + URL payloads stay disabled** in Add Product and Billing camera scanning.
- **Code 128 and ITF-14 disabled by default**, but architecture must allow re-enabling later via an explicit **"Extended Barcode Support"** setting or a separately-confirmed custom-code workflow. Do not permanently delete support for legitimate product formats.
- **Unsupported formats must never silently create a product.**

### Backup restore semantics rule
- Full `.mobbackup` restore = **validated Replace** (not Merge-default).
- Before Replace: **auto-create a verified pre-restore safety backup**.
- Product CSV import = **previewed Merge**.
- **Full-database Merge only if** explicit, tested conflict rules exist for products, categories, sales, sale items, payments, customers, inventory movements, settings, active/deleted records, timestamps, barcodes, and sale numbers. Otherwise mark full Merge as **future work** — do not ship an unsafe merge.

### Native prebuild safety protocol
Prebuild = potentially broad native rewrite; use only when direct safe native/config edits are insufficient.
- **Before:** inspect existing Android customizations; record `git diff -- android app.json`; make a temp filesystem copy of `android/` OUTSIDE the repo; document the exact reason prebuild is required.
- **After:** `git diff -- android app.json`; review every generated change; keep only icon/splash/plugins/permissions/config changes; restore unintended changes from the temp copy; run local Gradle debug + release before closing the phase.

## Checkpoints
- **A (after Phases 0–2):** baseline recorded; theme + startup tests pass; app bundles; local Android build works; this doc updated.
- **B (after Phases 3–8):** inventory + billing work; barcode tests pass; migration tests pass; SQL report tests pass; no full-table screen loads remain where pagination was required; this doc updated.
- **C (after Phases 9–12):** backup/restore rollback tests pass; image-lifecycle tests pass; merged release manifest inspected; full verify + stress pass; local debug + release APKs exist.

---

## Worktree baseline (recorded at Phase 0 start)

`git status --short --branch` → `main...origin/main`.

**Modified tracked (16, = user baseline, preserve):** App.tsx, ErrorBoundary.tsx, README.md, assets/adaptive-icon.png, assets/icon.png, eas.json, index.ts, screens/{About,AddItem,BillReceipt,Billing,Dashboard,Inventory,Reports,Settings}Screen.tsx, src/contexts/ThemeContext.tsx.

**Untracked (uncommitted user work, preserve):** android/, app.json, package.json, package-lock.json, tsconfig.json, babel.config.js, metro.config.js, eslint.config.js, AGENTS.md, App_logo.png, guid.txt, ic_launcher.zip, prompt.txt, assets/splash-{light,dark}.png, docs/, screens/BillReviewScreen.tsx, and all of src/{db,domain,repositories,services,hooks,theme,components/ui,__tests__,...}, src/types.ts.

`git diff --stat`: 16 files, +1853 / −2315 (largest churn: BillingScreen, ReportsScreen, BillReceiptScreen). Line-ending note: repo introduces LF→CRLF warnings on tracked files (cosmetic; do not mass-normalize).

---

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 0 — Baseline & deps | ✅ Complete | Green baseline; see command log |
| 1 — Shell/theme/splash/skeletons/branding | ⚙️ Code complete — device/build QA pending | Theme model, splash, skeletons, error boundary done + green. Native launcher swap → Checkpoint A |
| 2 — Dialogs/toasts/recovery UI | ⚙️ Core complete | ToastProvider + DialogProvider built & root-wired; Settings fully migrated (10 alerts). Remaining ~27 Alert sites + camera-pause + back-to-exit fold into screen phases 3/4/5/8 |
| 3 — Dashboard/activity | ⚙️ Code complete — device QA pending | Real action cards, notifications bell w/ low-stock badge, exit toast (no hardcoded snackbar), dropped duplicate Settings tile. New RecentActivityScreen + NotificationsScreen (FlatList + skeleton). Dashboard summary still loads bills in JS → SQL aggregate deferred to Phase 7 |
| 4 — Inventory/Add Product | ⚙️ Code complete — device QA pending | Inventory: no redundant title, header "+", shared SearchBar, filter sheet (stock/category/sort) w/ active-count, tap=edit + long-press=select + visible delete, Rs. currency, skeleton, alerts→dialog/toast, colorless-button fix. AddItem: compact square camera w/ reticle, camera paused (`active`) when manual dialog open, ref-based duplicate-scan guard, bottom-inset manual button, retail-only barcodeTypes (QR removed), alerts→toast. Deferred: recently-added/barcode-missing filters + FTS (Phase 7); similar-name warning (Phase 6); image compression lifecycle (Phase 10) |
| 5 — Billing/checkout | ⚙️ Code complete — device QA pending | Redundant title removed; camera paused via useIsFocused + modal state (`active`); retail-only barcodeTypes; scan/sound/lookup wrapped in try/catch; direct numeric qty input + / − ; Browse-products picker sheet; dark-mode scan toasts. BillReview: title removed, 3 alerts → dialog/toast, dark-mode tax toggle, duplicate-submit guard + receipt-after-persist retained |
| 6 — Barcode reliability | ⚙️ Code complete — device QA pending | New src/domain/barcode.ts (sanitize, EAN/UPC checksum, canonical UPC-A→EAN-13, classify) + 12 tests. AddItem: suspicious-scan confirm + similar-name warning. Billing: equivalence-aware lookup. Manual entry = user-confirmed custom-code path (no hard reject). Retail types in shared const → Extended-Barcode setting is future. **Soft-delete UNIQUE-barcode migration deferred to Phase 7** (schema change) |
| 7 — SQLite/query hardening | ⚠️ Partial | **Done:** migration 003 (additive indexes: idx_payments_sale_id, idx_products_deleted_at, idx_sales_status, idx_inventory_movements_created_at) + test updated + Settings shows 003. **Gated/deferred (needs real-SQLite integration harness to change safely — no data-corrupting blind edits):** transaction-wrapping the `replaceInventorySnapshot`/`upsertInventoryItem`/stock read-modify-write paths, atomic conditional stock update, soft-delete UNIQUE-barcode table rebuild, DB pagination APIs, reports SQL aggregation. **Reason:** app's product-write path is the array-based `saveInventory`→`replaceInventorySnapshot`; a table-rebuild migration + txn refactor without integration tests risks shop data. Recommend building the SQLite test harness (Phase 12) first, then landing these. |
| 8 — Reports | ⚙️ Code complete — device QA pending | **Flicker fixed:** initial-load vs refresh split, previous report stays visible on range switch, stale-response guard (reqRef), inline "Updating…" indicator instead of full-screen remount. Redundant AppHeader title removed; skeleton for first load; export/load alerts → dialog. Report already had top-by-qty/revenue, payments, avg bill, trend, low-stock. SQL aggregation still JS-side (gated w/ Phase 7). |
| 9 — Backup/restore | ⚠️ Partial | **Done:** new src/domain/backupManifest.ts (FNV-1a checksum, manifest w/ app+schema version, exported_at, counts) + validateBackup (preview + corruption/manifest checks) + 7 tests; storage.buildBackupSnapshot now embeds the manifest; storageService.validateBackup exposed; migrate.ts exports SCHEMA_VERSION/LATEST_MIGRATION_ID. **Deferred:** restore UI (preview/merge-vs-replace) + transactional apply with pre-restore safety backup + rollback — gated on the SQLite integration harness (same reason as Phase 7); full JSON is currently export+validate only. |
| 10 — Images | ⚙️ Code complete — device QA pending | Compression (resize→800px, q0.7 JPEG) + save-to-app-dir + delete-prior-on-replace + delete-on-product-delete already present. **Added** src/services/imageStorage.ts: `PRODUCT_IMAGE_DIR`, `ensureImageDir`, `cleanupOrphanImages(referencedUris, {dryRun})` — deletes only unreferenced files inside the app-owned dir, never external files, with dry-run preview. Remaining: thumbnails + wiring the cleanup action into Settings. |
| 11 — Security/permissions | ⚠️ Partial | **Done:** RECORD_AUDIO + SYSTEM_ALERT_WINDOW force-removed via `tools:node="remove"`; `allowBackup="false"`. SQL already parameterized; Linking allowlisted; no secrets (verified in audit). Retail-only scanner + CSV/backup validation added in earlier phases. **Verified (debug merged manifest):** RECORD_AUDIO stripped (RA=0 across all merge stages); `allowBackup="false"` applied. SYSTEM_ALERT_WINDOW still shows in the *debug* merged manifest because React Native's **debug-only** dev-tools manifest (`react-android-0.83.6-debug`) declares it — it is absent from release builds; verifying in the release manifest. **Remaining:** `npm audit` triage doc, app-level init-failure recovery screen. |
| 12 — Tests/APK/device QA | ⚠️ Partial | **Verified green:** typecheck, lint, `jest` **16 suites / 61 tests** (was 39; +22), `expo-doctor` 18/18, `expo export --platform android`. **Debug APK BUILT & VERIFIED:** `android/app/build/outputs/apk/debug/app-debug.apk` (~211 MB, all-arch debug), Gradle BUILD SUCCESSFUL (after clearing a corrupted Gradle transform cache — env issue, not code). **Release APK BUILT & VERIFIED:** `android/app/build/outputs/apk/release/app-release.apk` (~113 MB), Gradle BUILD SUCCESSFUL in ~15m; bundles JS (all phase work ships). Release merged manifest confirms **SYSTEM_ALERT_WINDOW=0, RECORD_AUDIO=0, allowBackup="false"**. Debug-keystore-signed → **local testing only, NOT Play-Store distribution** (real keystore = future work, per instructions). EAS: no · AAB: no. **Not done (environment limits):** DB-level SQLite stress harness (needs real-SQLite-in-Jest); device install + screenshots (no emulator/device attached). `npm audit`: 13 moderate, ALL in Expo build/dev tooling (@expo/config transitive via jest-expo/metro-config/prebuild-config/expo-sharing) — dev-time only, no runtime exposure, no non-breaking fix available → not force-fixed. |

## Command log

### Phase 0 baseline (deps restored)
- `npm ci` → exit 0, 656 packages. Warn: `unrs-resolver@1.12.2` postinstall not auto-run (npm allow-scripts); lint import-resolver still works.
- `npm run typecheck` (`tsc --noEmit`) → **pass**, 0 errors.
- `npm run lint` (`expo lint`) → **pass**, 0 problems.
- `npm test` (jest) → **13 suites / 39 tests pass**, ~16s.
- `npm run test:stress` → **4 pass**. Local JS timings: CSV 5k ~61ms; report 2k sales ~220ms; inventory search 5k ~6ms; dashboard/scanner ~3ms. (JS/Jest only — not device perf.)
- `npm run doctor` (`expo-doctor`) → **18/18 checks pass**.
- `npm audit` → **13 moderate**, ALL in Expo build/dev tooling (`@expo/config` transitive via `@expo/metro-config`, `jest-expo`, `@expo/prebuild-config`, `expo-sharing`, `@expo/local-build-cache-provider`). Dev/build-time, not app runtime. **Not force-fixed** (per rules). Revisit in Phase 11.
- `npx expo export --platform android` → **success**, 1 Android Hermes bundle 4.4MB; `dist/` artifact removed after validation.

**Baseline verdict:** fully green. Any later failure is newly introduced.

## Unresolved risks / manual QA pending

- No physical Android device connected during implementation → all device-dependent phases will be marked `Code complete — physical-device QA pending`.
