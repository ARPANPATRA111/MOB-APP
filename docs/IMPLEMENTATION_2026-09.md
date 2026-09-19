# September implementation and validation

MOPX 2.1.0 implements the eight approved retail workflows on the existing offline SQLite foundation. No backend, cloud sync, authentication system or payment gateway was added. No commits or pushes were made.

## Delivered workflows

| Workflow | Behavior |
| --- | --- |
| Complete backup/restore | Encrypted portable `.mopx` archive; all 18 tables, photos, draft bills, seller/settings snapshots and preserved legacy sources. Password/authentication, hashes, schema, foreign keys and record counts are checked before restore. Restore copies validated records into the trusted schema in one transaction and retains a separate encrypted safety backup. Local reminders support daily, weekly, monthly or off. |
| Park/resume | A single durable checkout draft, automatic persistence, named parked bills, resume/discard and checkout idempotency. Stock changes only on a completed sale. |
| Purchases/suppliers | Supplier directory, purchase references and received costs, weighted-average restocking costs, purchase details and inventory movements. |
| Cost reporting | Historical sale cost snapshots, net sales, known profit/margin, missing-cost coverage, valuation, collections and outstanding credit. Historical missing costs are never invented. |
| Split/change | Separate Cash/UPI/Card amounts, tendered cash versus money applied, cash change and validated credit balance. These are bookkeeping entries, not payment processing. |
| Units/import | Whole or fractional units, per-product thresholds, cost price and CSV preview with errors, version checks, optional-field preservation and explicit metadata-versus-stock-count choice. |
| Receipts/printers | Receipt search/pagination, customer phone, historic seller/currency, installment details, PDF sharing, reprinting, Android system printing, Bluetooth Classic SPP and TCP ESC/POS raster output for 58/80 mm paper. |
| Credit installments | Named customer balances, optional due dates, overdue summary, payment method/reference/date and immutable installments with overpayment/duplicate protection. |

## Audit fixes and optimization

- Replaced live inventory snapshot overwrites with direct product commands and version checks; archive/restore preserves stock. Internal identifiers no longer collide when codes normalize similarly.
- Sales, purchases, imports, stock movements, credit collection and restores are transactional. Foreign keys are enabled on each transaction connection. Initialization failures can be retried and cannot silently open an uninitialized POS.
- Corrected money, percentage-tax and fractional-quantity rounding, excessive discounts, stock validation, phone persistence and legacy zero-stock parsing. Fractional inventory valuation uses the same half-cent rounding direction as billing.
- SQL aggregates avoid multiplying receipt totals across joined rows. Receipt fetching is batched; product and receipt screens page through the database. Reports refresh on focus/data changes and filter by the selected dates. Week/month/year boundaries and collection dates are handled explicitly.
- Backup/restore includes images and raw migration sources. Archives use AES-256-GCM authenticated chunks and PBKDF2-HMAC-SHA256; native streaming keeps memory bounded. Untrusted archive schemas/triggers are not installed into the live database. Photo paths, archive traversal, duplicates and expanded sizes are checked.
- CSV parsing supports quoted multiline cells and rejects malformed rows before import. CSV exports neutralize formula-like values; receipt HTML escapes values. CSV cannot import arbitrary file paths.
- Expo SDK 55 dependencies are aligned. Deprecated `expo-av` was replaced with `expo-audio`; unnecessary microphone/overlay/broad storage permissions are blocked. Android automatic backup is disabled; release signing cannot fall back to the debug key.
- Native-stack transitions, reduced-motion handling, focus-aware camera mounting, system fonts, consistent grouped surfaces, large controls, clear error/empty states and corrected bottom/keyboard spacing. Checkout keeps totals and completion visible. The scanner's collapsed controls leave more space for products.
- Receipt payment summaries deduplicate methods and render installment separators correctly. Generated inspection/build folders are excluded from Metro, Jest and TypeScript discovery.
- Icon imports now include only used font assets. The Android Hermes export decreased from about 4.6 MB to 4.3 MB, and the release export includes only Ionicons instead of the entire vector icon font collection. This is a bundle measurement, not a claim about FPS on every device.

## Validation completed before cloud build

- `npm run verify`: typecheck, lint, 20 Jest suites / 89 tests, native signing/configuration guards and Expo Doctor 19/19 passed.
- Real SQLite harness: actual production repositories/migrations against SQLite, including migrations twice, preserved zero-stock legacy rows, idempotent sale, stock rollback, aggregate correctness, supplier/purchase costs, installments, stale imports, failed restore rollback, all-table restoration and fractional valuation rounding.
- `npm run test:stress`: 4 tests passed. Fixtures include 5,000 products for CSV/search and 2,000 sales for report aggregation. These timings are local development-machine measurements.
- Native Gradle debug build passed. `:retail-tools:testDebugUnitTest`: 6 tests passed, covering multi-chunk round trips, empty payload, wrong password, corruption, truncation/trailing bytes, output limits and password validation.
- Android Hermes export passed after the final workflow fixes. Final local signed x86_64 release assembly also passed (807 tasks); APK signature verified, SDK 24 minimum / 36 target, no debuggable flag.
- With Metro stopped, the signed release launched, inspected and restored the encrypted QA archive, created its safety backup, and displayed the expected 18.5 kg rice / 17 soap stock and 57.50 outstanding credit. Android crash buffer was empty after these app workflows.
- Android emulator, API 36: exercised real Expo SQLite repositories and native module with synthetic test data. Verified weighted purchase costs, idempotent sale, genuine split/credit totals, two installments, cash change, parked draft, reviewed import, SQL profit/credit and all-table restore including the photo hash and safety backup. Wrong passwords were rejected.
- Repeated a native backup/restore with an explicit dark theme after fixing the JSON preference encoding; theme persisted correctly.
- UI smoke on a 360 x 640 dp Android layout: inventory-backed billing, review, cash completion/receipt, light/dark rendering, settings and backup selection through Android Documents. The restore confirmation, progress, completed restore and safety-backup share sheet were exercised.
- Network thermal output: captured and validated 11,113 bytes of ESC/POS initialization/raster output from a native Unicode receipt. This verifies the rendering/transport pipeline against a TCP test receiver; it does not verify paper output or Bluetooth hardware.
- Additional Android checks: receipt PDF generation produced a valid one-page PDF; notification permission was requested through Android and the weekly reminder was registered with a repeating 604,800-second trigger.
- EAS archive inspection confirmed that local signing files were excluded and the native module/security patches were present. Upload was 34.2 MB.

Local evidence is kept under ignored `output/` and native build test-result directories. Synthetic emulator records are not bundled in the APK.

## Security dependency status

The baseline audit reported 31 affected package entries (11 high, 20 moderate). After supported dependency updates and the `xcode` UUID override, `npm audit` reports 12 affected transitive entries (4 high, 8 moderate), stemming from three upstream advisories:

- [Malformed URI decoder complexity](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr): the repository patch backports the upstream linear decoder while retaining the older CommonJS API.
- [Image container parser loops](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq): validate box lengths before advancing.
- [ICNS parser loop](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr): reject zero/invalid/out-of-bounds entry sizes.

The patches apply through `patch-package --error-on-fail` after installation. Regression checks use actual patched dependencies, valid image/URI inputs and malicious length/encoding fixtures with a process timeout. Advisory scanners still see the original dependency version ranges, so this is not a zero-advisory claim. Do not use a forced audit fix that downgrades Expo incompatibly. Replace patches when compatible upstream fixes are available.

## Limits and device checks

- Physical barcode-camera recognition, Bluetooth pairing, printer firmware/paper output and device-specific notification/power management still need checks on the user's Android device. No physical printer was available.
- No universal performance, accessibility or security certification is claimed. TalkBack and enlarged-font combinations have not received a complete device matrix review.
- On-device SQLite is protected by Android app isolation/device protection; only exported full archives are separately password encrypted. PDF/CSV exports are readable to recipients.
- Backups are limited to 512 MB encrypted / 1 GB expanded and 50,000 photo files. Missing referenced photos stop a complete backup rather than silently omitting them. Remember the password and save copies outside the phone.
- Product/receipt lists page through SQLite. Purchase/movement/draft histories currently expose the latest 100; supplier selection is capped at 500, credit search at 100 open bills. These are explicit current UI limits, not database deletion or report-total limits. Broad multi-year chart ranges show at most 366 points and top-product reports at most 100 products.
- Tax is configured per bill; mixed per-product tax regimes, returns/exchanges, cloud sync and multi-operator access were outside the approved feature scope.

## Cloud APK

Replacement EAS preview build submitted: `d545e223-0ecc-4f60-a84d-cd3b461b9f51`, app 2.1.0, Android versionCode 6.

[Build status and installation](https://expo.dev/accounts/arpan111/projects/mob-app/builds/d545e223-0ecc-4f60-a84d-cd3b461b9f51)

The earlier queued build was canceled before building to include the final receipt corrections.

**Finished successfully on September 15, 2026.** [Download the tested APK](https://expo.dev/artifacts/eas/v9Hbq3e0gu5OkNyU_4RHv2N3DWh3Qa9swZpfyIWEh3I.apk).

- APK: version 2.1.0 / versionCode 6; 118,204,337 bytes (about 118 MB); ARM64, ARMv7, x86 and x86_64. Minimum Android 7.0 (API 24), target API 36; no debuggable flag.
- SHA-256: `e36264c1b38c3a0416e97df6f5465ec0c614455f9db09aaf4e07e1c3b4d543d8`.
- APK signature verified and matches the local signed release. Installed over that release with `adb install -r`, without clearing its restored QA data.
- With Metro stopped, airplane mode enabled and Wi-Fi/mobile data disabled, the cloud APK cold-launched. Three products, stock quantities (18.5 kg rice / 17 soap) and the 57.50 installment balance were preserved.
- Completed a new offline cash checkout for one soap at 62.00. Receipt and dashboard showed 62.00, stock changed from 17 to 16 once, and existing credit remained 57.50. Android crash buffer was empty.
- Release receipt lookup by phone and historical prices were also checked. Emulator network/display settings were restored after testing.

Local copy: `output/MOPX-2.1.0-preview.apk`. Test data stay in the QA emulator; the distributed APK contains no synthetic shop records. Back up existing shop data before updating a real device.

## References

- [React Native performance](https://reactnative.dev/docs/performance): native transitions, bounded rendering and release-mode performance checks.
- [React Native accessibility](https://reactnative.dev/docs/accessibility): roles, labels, state and readable controls.
- [Expo SQLite](https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/): local database and native backup APIs.
- [Expo Audio](https://docs.expo.dev/versions/v55.0.0/sdk/audio/): supported scanner feedback API.
- [Expo Modules](https://docs.expo.dev/modules/get-started/): local native module integration.
- [EAS APK builds](https://docs.expo.dev/build-reference/apk/): internally distributed Android APK configuration.
- [EAS local credentials](https://docs.expo.dev/app-signing/local-credentials/): separate signing material.
