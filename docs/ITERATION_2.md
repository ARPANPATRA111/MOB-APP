# Device feedback iteration — three phases

Requested September 15, 2026. Local Android builds only; do not submit EAS builds.

1. **Foundation and first impression:** compact Inter typography, small/medium/large text, keyboard visibility throughout forms and dialogs, inverted system-bar surfaces, native-to-app splash fade, first-run shop name/currency setup, concise home/settings, top notifications. Backup controls only in Settings.
2. **Everyday retail workflows:** paged fuzzy inventory search by name/category/price, compact filters/sorting/actions, simpler product editor with camera capture and optional fields, one-shot scanner confirmation, cart-first billing with editable quantities and a separate searchable product picker.
3. **Reports and release:** useful graphs and concise business summaries, compatible dependency/security updates, production checklist, regression and Android UI tests, signed local ARM APK and exact delivery path.

Preserve existing SQLite data and historical receipt/cost/currency correctness. Keep inventory movement audit records even when the UI supplies the routine correction reason automatically. No commit/push.

Status: superseded by [ITERATION_3.md](ITERATION_3.md) (2.3.0). The 2.2.0 APK shipped without loadable Inter fonts because of a stale expo-updates manifest; see the 2.3 notes.

## Delivered changes

- **Phase 1:** Inter regular/semibold/bold; three text sizes with Android accessibility scaling retained; explicit shop/currency setup; business-details editor; native splash registration and themed fade; safe-area headers; inverse system bars; keyboard-aware forms and sticky checkout controls; top toasts; compact home/settings. Backup creation is private, sharing is explicit, and controls are only in Settings.
- **Phase 2:** Debounced catalog search, stale-response guards, memoized rows and keyset pagination in pages of 40. Name/category/barcode/exact-price matching, with bounded one-edit/adjacent-transposition fallback. Bottom Add action and concealed filtering/import. Simple product forms, optional buying cost/threshold, camera/gallery photos, two-second one-shot scanner. Cart-first billing with quantity inputs and a separate product picker; split/credit/tax details expand when needed. Stock adjustments retain inventory movements and an automatic audit reason.
- **Phase 3:** Seven-day report default, visible interactive graph, sales/profit/collections/unpaid summaries and top products. Optional accounting details. At most 12 chart bars preserve the supplied series total; the existing trend source remains capped at the latest 366 days for long ranges. Compatible React Navigation/Metro updates remove the vulnerable URI/image dependency paths. Obsolete post-install patches and patch-package removed.

## Production checklist and evidence

- [x] TypeScript, ESLint and native configuration/runtime/signing guards pass.
- [x] 23 Jest suites / 94 tests pass. One earlier run under heavy host memory pressure timed out starting a security subprocess; the full rerun passed after reducing load.
- [x] Four stress tests pass.
- [x] Real SQLite: migration idempotency/legacy zero stock, sale rollback/idempotency, stock movements, purchase costs, split/change, installment credit, import concurrency, complete transactional restore and catalog pagination pass.
- [x] Expo Doctor 19/19. Generated-config synchronization is deliberately disabled for the checked-in Android project; native guards check the managed fields.
- [x] npm audit: **zero known advisories**. This is not a guarantee against every possible vulnerability. Upstream URI/image parser regression checks pass without post-install patches.
- [x] Desktop SQLite benchmark: 50,000 added products and 20,000 sales/items/payments. First page 5 ms, name 8 ms, typo 35 ms, no-match 105 ms, price 9 ms, full report 138 ms. One-run desktop measurements, not Android guarantees.
- [x] Android 36 emulator at 360 x 640 dp: first-run setup, product entry, typo search, product picker, quantity editing, $37.50 checkout/$50 cash/$12.50 change, dark theme and large text. Product/category/cost/cart/payment inputs remain visible above the keyboard.
- [x] Six native archive encryption tests pass (Gradle `:retail-tools:testDebugUnitTest`).
- [x] Actual mounted CameraView callback checks: duplicate frames add one item after the reading delay, scanner closes, cancellation leaves the cart unchanged. Emulator render completion was slower than the two-second acceptance timer under host load.
- [x] Lower multiline receipt-message field remains visible with the keyboard and large text. An earlier ANR during emulator/host memory and I/O pressure was investigated; the isolated rerun passed. Trace evidence is retained in ignored output files.
- [x] Native encrypted backup creation, wrong-password rejection and restore of the previous-version archive pass. Restored 3 products, 2 sales, 5 payments, 1 purchase, 2 saved drafts; outstanding credit 57.50 with installment history; photo SHA-256 matched; SQLite integrity check returned `ok`; a safety backup was created.
- [x] Signed local release build succeeded in 11m 53s (882 Gradle tasks). APK: 2.2.0/code 7, Android 7+ (min SDK 24), target SDK 36, ARM64/ARMv7/x86/x86_64.
- [x] APK signature matches the previous release: certificate SHA-256 `a44c115bf155b9da946a5e1e7b63b87c5e388772eaee317985ea38711cd43e3c`. Release is not debuggable; automatic backup remains disabled; microphone, overlay and broad storage permissions are absent. No signing credentials or QA backup is packaged.
- [x] APK font inspection: Inter Regular/SemiBold/Bold, Ionicons, and the existing Roboto Medium asset. The full Inter family is not bundled.
- [ ] Release cold-launch and upgrade preservation.

Logs and screenshots: ignored `output/iteration2-*` artifacts. Current automated evidence: `iteration2-verify-final.log`, `iteration2-stress.log`, `iteration2-sqlite-benchmark.log`, `iteration2-audit.json`.

## Local delivery and limits

Command: `android\gradlew.bat -p android :app:assembleRelease`. Uses the installed Android SDK and Gradle, the same build system as Android Studio. No EAS build.

Target APK: `B:\Public Repository\MOB-APP\output\MOPX-2.2.0-local.apk`. Gradle original: `B:\Public Repository\MOB-APP\android\app\build\outputs\apk\release\app-release.apk`.

Built locally September 16, 2026. Size: 120,050,921 bytes (120.05 MB). APK SHA-256: `1a90bb4912597c65c9047e25ff6c2c536ad10504f37b9794c5d4a2334ba520a7`.

Native build emitted upstream deprecation/parameter-name warnings and an Expo NODE_ENV warning; Gradle completed successfully. Expo generated the production Hermes bundle. No dependency audit advisories or application TypeScript/ESLint errors remain in the verified source.

Schema remains version 4. Existing records are preserved. Currency changes remain restricted after the first sale/purchase to preserve accounting correctness, disclosed during setup and editing. Signing credentials remain ignored.

Physical camera focus, thermal-printer pairing/paper output, OEM keyboards and animation smoothness on the user's phone require device acceptance testing. Search still scans SQLite rows for substring/fuzzy queries; English typo support is bounded to 3-24 characters. Management list and archive/import limits remain as documented in README.

## Changed files

- Entry/config: `App.tsx`, `app.json`, `package.json`, `package-lock.json`, `README.md`, `android/app/build.gradle`, `android/app/src/main/java/com/arpanpatra/mopx/MainActivity.kt`, Android `values/strings.xml` and `values/styles.xml`.
- Screens: `SetupScreen`, `BusinessDetailsScreen`, `DashboardScreen`, `SettingsScreen`, `InventoryScreen`, `AddItemScreen`, `ProductPickerScreen`, `BillingScreen`, `BillReviewScreen`, `ReportsScreen`, `BackupScreen`, `ManagementScreen`; typography imports in other screens.
- Components/context: `TypographyContext`, `ProductRow`, `ProductScanner`, `ui/{AppScreen,StackHeader,AppSplash,AppButton,CommerceUI,SelectField,ToastProvider,TrendChart}`; shared typography imports in existing components.
- Domain/data: `useProductCatalog`, `productRepository`, `domain/{onboarding,catalogSearch,chart}` and tests. `scripts/{test-sqlite,check-dependency-patches}.cjs`, `src/__tests__/dependencySecurity.test.ts`. Removed obsolete dependency patches.
- The [workspace change list](CHANGED_FILES_2026-09.md) includes the preceding feature iteration. User-edited `prompt.txt` is not part of these changes.

## Official references

- [Expo keyboard handling](https://docs.expo.dev/guides/keyboard-handling/) and [React Native keyboard avoiding view](https://reactnative.dev/docs/keyboardavoidingview).
- [Expo SDK 55 keyboard controller](https://docs.expo.dev/versions/v55.0.0/sdk/keyboard-controller/), [splash screen](https://docs.expo.dev/versions/v55.0.0/sdk/splash-screen/) and [fonts](https://docs.expo.dev/develop/user-interface/fonts/).
- [React Navigation safe areas](https://reactnavigation.org/docs/handling-safe-area/) and [native-stack headers](https://reactnavigation.org/docs/native-stack-navigator/).
- [Expo local production builds](https://docs.expo.dev/guides/local-app-production/).
