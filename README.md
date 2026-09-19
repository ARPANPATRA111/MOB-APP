# MOPX - Retail POS & Inventory

MOPX 2.5 is an offline-first Android retail app built with Expo SDK 55, React Native 0.83, React 19 and TypeScript. SQLite holds business records; AsyncStorage holds preferences and preserved legacy migration sources. No backend, account, cloud sync or payment gateway is included.

## Shop workflows

- Password-encrypted full backup/restore, including photos, receipts, payments, purchases, saved bills and settings. Restore validates the archive and creates a safety backup first. Optional local reminders help you keep an external copy.
- Durable unfinished bills, with park/resume and transactional checkout.
- Suppliers, purchase receipts, restocks and inventory movement history.
- Moving weighted-average costs, historical sale cost snapshots, profit/margin, inventory valuation and explicit missing-cost coverage.
- Cash/UPI/card splits, separate cash tendered/change, credit balances and installment history. These record payments; they do not process money.
- Product units, fractional quantities, per-product restock thresholds and CSV preview with stale-data checks before import. `docs/samples/MOPX-sample-products.csv` is a ready-to-import catalog of 65 typical general-store products with valid in-store barcodes.
- Searchable receipts, PDF sharing, reprinting, Android system printing and ESC/POS network/Bluetooth Classic printers with 58/80 mm raster receipts.
- Cart-first checkout with in-bill search (name or price, one typo forgiven), compact two-line cart rows that stay usable on a 200-line bill, paged name/category/price search with typo fallback, camera photos and one-shot scanning.
- First-run shop/currency setup, Inter typography with three text sizes, keyboard-aware forms and light/dark themes.
- Concise SQL reports with interactive sales graphs and optional accounting details.

## Development

Use Node 24 and the Android SDK/JDK required by Expo SDK 55. The checked-in Android project and local `modules/retail-tools` module are required for encrypted backups and direct thermal printing; Expo Go cannot exercise those features.

```sh
npm ci
npm start
npm run android
```

```sh
npm run verify
npm run test:stress
npm run test:sqlite
npx expo export --platform android
```

Native encryption tests on Windows:

```powershell
.\android\gradlew.bat -p android :retail-tools:testDebugUnitTest
```

The real SQLite test harness runs production TypeScript against Node SQLite. Jest also covers domain logic, migrations, receipts, scanner/cart behavior and dependency security regressions. These checks do not claim universal device or printer coverage.

## Android builds

Build locally with the installed Android SDK and Gradle (the same build system used by Android Studio):

```powershell
.\android\gradlew.bat -p android :app:assembleRelease
```

Add `:app:bundleRelease` to the same command for the Play Store AAB (`android/app/build/outputs/bundle/release/app-release.aab`). The signed APK is written to `android/app/build/outputs/apk/release/app-release.apk`. The build forces expo-updates to regenerate its embedded `app.manifest` every time (the upstream task declares no JS inputs, and a stale manifest silently drops newer assets such as fonts from the release). After building, `unzip -p <apk> assets/app.manifest` should list the Inter `ttf` assets. Release signing reads private local credentials; signing files must remain ignored. Unsigned release builds fail rather than falling back to a debug key. The checked-in native configuration is validated by `npm run check:native`. Review native configuration changes deliberately; a fresh prebuild can overwrite manual manifest and signing changes.

The Play Store bundle can also be built on EAS with the same upload key: `npx eas build --platform android --profile production`. `eas.json` uses `appVersionSource: local`, so the `versionCode`/`versionName` in `android/app/build.gradle` are the single source of truth for both local and cloud builds — bump them by hand for every release (see `docs/RELEASE_2.5.0.md`).

## Announcing updates

EAS Update (OTA) is checked automatically at launch and from Settings → Check for updates. For new store/APK builds, `docs/update.json` is fetched by installed apps at most once a day (nothing is sent). Bump `latestVersion` when you publish a release; users on older builds see an "Update available" row in Settings and, if they already allowed notifications, one low-priority notification. `minSupportedVersion` marks older builds as needing the update.

## Data and operating limits

- Migrations are additive and idempotent. Legacy AsyncStorage sources are never deleted.
- Checkout, purchases, stock edits, installments and restore writes are transactional. Historical costs that were never recorded remain unknown.
- Full archives use authenticated AES-256-GCM encryption and password derivation. The on-device SQLite database relies on Android app isolation/device protection; it is not separately SQLCipher encrypted.
- Keep encrypted backups outside the phone. Android automatic backup is disabled. Losing both the device and its external backup, or forgetting the archive password, cannot be repaired by an account reset.
- Full archive limits: 512 MB encrypted, 1 GB expanded, up to 50,000 image files. Missing referenced photos must be corrected before a complete backup can finish. CSV imports allow 10 MB/10,000 rows.
- Product and receipt lists use database pagination. Purchase/movement/saved-bill views show the latest 100 records; supplier selection is capped at 500 and credit searches return up to 100 open bills. Reports include all matching sales, with top-product lists capped at 100 and chart series capped at 366 days.
- Bluetooth support targets paired Classic SPP ESC/POS printers. BLE-only or proprietary printers may need their manufacturer's Android print service. Actual paper output requires validation on your printer.
- Compatible React Navigation and Metro updates remove the previously flagged URI/image dependencies. `npm audit` reported zero known advisories in this iteration; rerun it when dependencies change. Regression checks exercise the upstream URI parser and bounded image parser. No post-install patches are required.
- Typo search supports one edit/transposition for English words of 3–24 characters, after literal matches are exhausted. Results are fetched in pages of 40; substring/fuzzy queries still scan matching catalog rows and are not an unlimited-scale search engine.

The [project audit](docs/PROJECT_AUDIT_2026-09-13.md) records baseline findings. The [implementation and validation record](docs/IMPLEMENTATION_2026-09.md) records the work, evidence and remaining limits.

The [second iteration](docs/ITERATION_2.md) records the latest UI changes, validation and local APK delivery.
