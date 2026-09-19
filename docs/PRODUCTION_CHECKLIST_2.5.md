# MOPX 2.5.0 — production readiness check

Reviewed September 19, 2026 on branch `release/2.5.0-billing-polish`. ✅ verified now · ⚠️ owner action at submission · ➖ not applicable. Items unchanged since the 2.4 review are kept so this page stands on its own.

## Build & packaging

- ✅ `applicationId com.arpanpatra.mopx`, versionName 2.5.0, versionCode 12 (11 was 2.4.2). `npm run check:native` confirms `app.json` version, `runtimeVersion` and `strings.xml` `expo_runtime_version` agree.
- ✅ One source of truth for the version: `android/app/build.gradle`. `eas.json` now uses `appVersionSource: local` (the EAS remote counter was 6 and would have produced a build Play rejects). Bump `versionCode` by hand each release.
- ✅ minSdk 24 (Android 7.0), targetSdk 36 / compileSdk 36.
- ✅ arm64-v8a + armeabi-v7a + x86 + x86_64; Hermes; New Architecture; edge-to-edge.
- ✅ Release not debuggable; `android:allowBackup="false"`.
- ✅ Signing: upload key `mopx-upload-key.jks` through ignored `credentials.json`; certificate unchanged (`a44c115b…`). Gradle and EAS both sign with it. An unsigned release build fails instead of falling back to the debug key.
- ✅ expo-updates embedded manifest regenerated on every Gradle build (`outputs.upToDateWhen { false }`); runtime version 2.5.0 for OTA targeting. Publish JS-only fixes with `eas update --channel production` against runtime 2.5.0.
- ✅ 16 KB page alignment and font assets in the manifest are checked on the produced APK (see RELEASE_2.5.0.md → Artifacts).

## Permissions & privacy

- ✅ Runtime permissions: CAMERA (scanning, photos), POST_NOTIFICATIONS (opt-in reminders), BLUETOOTH_CONNECT (receipt printers). INTERNET only for the daily `update.json` fetch, EAS Update check, sharing and printing.
- ✅ Blocked: RECORD_AUDIO, SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE.
- ✅ No analytics, accounts, identifiers or cloud sync. Nothing new in 2.5 touches the network.
- ⚠️ Data safety form, privacy policy URL and content rating: unchanged from 2.4 — confirm they are still marked complete in Play Console before rollout.

## Quality gates run now

- ✅ TypeScript `tsc --noEmit` clean.
- ✅ ESLint 0 errors / 0 warnings.
- ✅ Jest 27 suites / 119 tests (new: cart search 12, sample CSV 3, receipt icons 1).
- ✅ Native config guard passes.
- ⚠️ Expo Doctor 18/19: `expo-updates` 55.0.30 installed, SDK now expects ~55.0.31 (patch published after the 2.4 review). Left as is for 2.5.0 on purpose — bumping a native module after the artifacts were built would mean rebuilding and re-verifying both; take it with the next release (`npx expo install expo-updates`).
- ✅ Emulator walkthrough (API 36, light and dark) of every changed screen plus a full sale — see RELEASE_2.5.0.md → Verification.
- ✅ Release APK installed on the emulator after the build: cold launch, bill with search, checkout, receipt.

## Functional readiness

- ✅ Offline-first; update checks fail silently without network.
- ✅ Money in integer cents; receipts keep their currency.
- ✅ Migrations idempotent; no schema change in 2.5.
- ✅ Cart order is unchanged for the sale record and receipt (oldest first); only the on-screen list shows the newest line on top.
- ✅ Scanner path untouched (`scan` → `billingSession.setCart`); continuous scanning and duplicate-add protection as in 2.4.
- ✅ Keyboard never covers the focused input: billing rows scroll into view on `keyboardDidShow`; the billing footer and tab bar hide on `keyboardWillShow`.
- ✅ Back button: only the Home tab intercepts (double press to exit); stack screens, modals and dialogs behave as before.
- ⚠️ Physical-device acceptance still recommended for: Gboard/Samsung keyboard behaviour on the cart quantity field, thermal printers, and the camera → Save timing on a slow phone (the light-blue lock was verified on the emulator where compression takes < 1 s).

## Store listing

- ⚠️ Replace screenshots and feature graphic with `docs/play-store/2.5.0/` (current design). The 2.3-era set shows the old UI.
- ⚠️ Paste the release notes, short and full description from RELEASE_2.5.0.md.
- ➖ No in-app purchases, no ads.

## Recommended rollout

- Staged rollout 20% → 100% after 24 h with no new ANR/crash clusters in Play Console vitals.
- Keep `docs/update.json` at 2.5.0 so 2.4.x installs see the "Update available" row.
