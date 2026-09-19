# MOPX 2.4.x — production checklist (Play Store readiness)

Reviewed September 16, 2026 against the current working tree. ✅ verified now · ⚠️ action for the owner before/at submission · ➖ not applicable.

## Build & packaging

- ✅ `applicationId com.arpanpatra.mopx`, versionName 2.4.2, versionCode 11 (monotonic; 10 was 2.4.1).
- ✅ minSdk 24 (Android 7.0), targetSdk 36 / compileSdk 36 — meets Play's current target-API requirement.
- ✅ 64-bit: arm64-v8a included (plus armeabi-v7a, x86, x86_64). Play requires 64-bit; older 32-bit phones keep working.
- ✅ 16 KB page-size alignment verified with `zipalign -c -P 16 -v 4` on the release APK (Play requirement for targetSdk 35+).
- ✅ Hermes, New Architecture, edge-to-edge enabled.
- ✅ Release is not debuggable; `android:allowBackup="false"` (records are in an encrypted user backup instead of Android auto-backup).
- ✅ Signing: upload key `mopx-upload-key.jks` via ignored `credentials.json`; certificate SHA-256 `a44c115b…`. An unsigned release build fails instead of falling back to the debug key.
- ✅ **AAB produced** (`android/app/build/outputs/bundle/release/app-release.aab`). Play Store only accepts AABs for new apps; the APK is for direct device testing.
- ⚠️ First Play upload: enrol in **Play App Signing** and upload the AAB; keep the upload keystore backed up offline. If you ever lose it, Play can reset an upload key but only with the original signer proof.
- ✅ expo-updates: embedded manifest regenerated on every build (fonts verified in `assets/app.manifest`). EAS Update OTA checks run at launch (`ON_LOAD`) and from Settings → Check for updates; publish JS-only fixes with `eas update` against runtime version 2.4.2.

## Permissions & privacy

- ✅ Declared runtime permissions: CAMERA (scanning, photos), POST_NOTIFICATIONS (backup reminders, update alerts — requested only when the user turns those on), BLUETOOTH_CONNECT (receipt printers). INTERNET is used only for the daily `update.json` fetch and sharing/printing.
- ✅ Removed/blocked: RECORD_AUDIO, SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE. Photos come through the system picker/camera; no broad storage access.
- ✅ No analytics, no accounts, no device identifiers, no cloud sync. Update check downloads a static file and sends nothing.
- ⚠️ **Data safety form**: declare "no data collected/shared"; camera used for barcode/photos; data not encrypted in transit is not applicable (nothing transmitted); user can request deletion by uninstalling (all data is local). Optional backups are user-initiated files encrypted with the user's password.
- ⚠️ **Privacy policy URL** is mandatory for the listing: host `docs/PRIVACY_POLICY.md` (GitHub Pages or the repo's rendered page) and link it in Play Console → App content.
- ⚠️ Camera permission prompt strings exist; confirm the Play listing's permission explanations match ("scan product barcodes", "product photos").

## Quality gates run now

- ✅ TypeScript `tsc --noEmit` clean.
- ✅ ESLint 0 errors / 0 warnings.
- ✅ Jest 25 suites / 103 tests (scanner state-machine, update-manifest, in-store barcode). Desktop SQLite benchmark with credit queries at 50k/20k/8k scale in `output/iteration5-sqlite-benchmark.log`.
- ✅ `npm audit`: 0 advisories.
- ✅ Expo Doctor 19/19; native config guard passes.
- ✅ Emulator (API 36) walkthrough on the debug build: cold start with 2 s splash floor, setup, home, stock entry, Find picker, continuous scanner UI with torch persistence, cart steppers, review, receipt, toast swipe-dismiss.
- ✅ Release APK cold launch on the emulator after build (see ITERATION_4 notes).

## Functional readiness

- ✅ Offline-first: every screen works with no network. Update check fails silently.
- ✅ Money kept in integer cents; historical receipts keep their currency.
- ✅ Migrations idempotent; restore is transactional; backups password-encrypted.
- ✅ Scanner: 1D retail symbologies only (QR ignored), one accept per presentation, camera frozen before close (no duplicate adds), unknown-code banner, torch state remembered.
- ✅ Old devices: RN's edge-to-edge applies system-bar scrims on Android < 10 automatically; no API-specific branches in app code. Fonts/animations degrade gracefully (reduced-motion respected).
- ⚠️ Physical-device acceptance still needed for camera focus on curved/glossy packs, OEM keyboards, and thermal printers.

## Store listing

- ⚠️ Refresh the Play listing screenshots (the ones in `assets/ScreenShots` predate the redesign) and the feature graphic; keep the 2.3/2.4 design.
- ⚠️ Short/long description: mention offline operation, barcode billing, stock, credit, reports, encrypted backups; state that no data leaves the phone.
- ⚠️ Content rating questionnaire (utility app, no UGC), target audience 18+ (business tool), ads: none.
- ➖ Payments: no in-app purchases in this version.

## Recommended before a wide rollout (not blockers)

- Crash reporting is absent by design (no third-party SDKs). If you want visibility, add an opt-in, self-hosted or Play-Console-only signal (Play's own ANR/crash stats work without any SDK).
- Staged rollout (10% → 50% → 100%) on Play Console to catch device-specific issues on older phones.
- Publish `docs/update.json` in the repo (already added) and bump `latestVersion` whenever you release, so 2.4.0+ installs show the update row and (if permitted) a notification.
