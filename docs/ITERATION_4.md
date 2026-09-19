# Iteration 4 — scanner, receipt, immersive UI (2.4.0 / code 9)

Requested September 16, 2026 after testing 2.3.0 on a phone. Local Gradle builds only; no EAS; no commit/push.

## Fixed / changed

**Scanner (`src/components/ProductScanner.tsx`)**
- Duplicate adds: the camera view is now unmounted *before* the async accept and the modal's exit animation, so no frame can arrive after a read. Previously the closing animation kept the camera live for ~300 ms and a product left under it was read again (double beep, +1 quantity) in both New bill and Add product.
- Hold time 1 s (was 2 s). A code that leaves the frame during the hold is discarded.
- Barcode-only: `ean13, ean8, upc_a, upc_e, code128, code39, itf14`; QR is not decoded.
- Unknown barcode: red "Unknown item" banner for 3 s inside the scanner (continuous mode) or under the viewfinder (single mode); scanning resumes automatically.
- **Continuous mode for billing**: one camera session for the whole basket. Each accepted code shows a green "Product · +1 · n in cart · total" chip for 1.4 s while scanning pauses; the same code is ignored while it stays in frame (900 ms presence gap), so leaving a product under the camera counts once and re-presenting it adds a second unit. Header shows the live cart summary; a large Done button sits at the bottom.
- Torch state is remembered across scans and app restarts (`scannerTorch` setting).
- Covered by `src/components/__tests__/productScanner.test.tsx` (single accept + freeze, presence suppression, pause during feedback, glance rejection).

**Billing (`screens/BillingScreen.tsx`)**
- One-handed layout: Scan products (primary) + Find, then total + Take payment, all in the sticky bottom bar. Parked bills stay in the header (rare action).
- Long-press a cart thumbnail to open a full-size photo preview.

**Receipt (`screens/BillReceiptScreen.tsx`)**
- Supermarket-style bill: centred shop header, bill number/date/customer lines, ITEM · QTY · RATE · AMOUNT table with tabular figures, dashed rules, totals right-aligned, payments and balance due, footer note. Actions are one compact row (Print · Share PDF · Collect/New bill); printer settings moved to the header gear. Receipts remain rows in SQLite; the PDF is generated only when shared.

**Splash / start**
- Cold-start floor of 2 s (`SPLASH_MIN_MS` in `App.tsx`), measured from JS start; longer automatically on slow devices until fonts, theme and database are ready. Resuming from background never shows it. Native and JS splash draw the same mark at the same spot; only the wordmark eases in.

**Home (`screens/DashboardScreen.tsx`)**
- No greeting, no duplicate "New sale" button (the tab bar's New bill is the entry point). Sales-today hero with date, change vs yesterday, bills / items sold / average bill; Stock and To-collect tiles; 7-day chart with week total; latest receipts; Reports and Manage rows. An "Open bill · continue" banner appears only when a cart is in progress.

**Typography**
- Plus Jakarta Sans (600/700/800) for titles and headline numbers, Inter (400/500/600/700) for text; tabular figures on all money columns; capped system font scaling.

**Toasts (`src/components/ui/ToastProvider.tsx`)**
- iOS-style banner card with tinted icon well and grabber; springs in from the top; swipe up or tap to dismiss; auto-dismiss after 2.4 s.

**System bars**
- Immersive edge-to-edge instead of inverted bars: status and navigation bars are transparent, the app paints behind them, and icon tint follows the theme. React Native's `enableEdgeToEdge` adds a light/dark scrim on Android 8–9 and a dark scrim below 8, so old devices keep legible buttons with no device-specific code.

**Update notifications (`src/services/updateCheck.ts`, `docs/update.json`)**
- Once a day the app downloads `docs/update.json` from the public repository and compares `latestVersion` with the installed version. Newer → an "Update available" row at the top of Settings and, only if the user already allowed notifications, one low-priority local notification. No device data is sent; failures are silent; Settings → "Check for updates" forces a check. To announce a release, edit `latestVersion` (and optionally `minSupportedVersion`, `message`, `url`) and push. A topic-based FCM push was considered and rejected for now because it needs a Firebase project and adds Google Play services dependencies; the static manifest covers the "tell users about a major update" case without any backend.

**Barcode-less products**
- Auto-generated codes are now valid in-store EAN-13 numbers (prefix 20, GS1 restricted range) instead of `SKU-…` strings, so shopkeeper-printed stickers scan with any scanner. See `docs/BARCODE_MARKET_RESEARCH.md`.

**Housekeeping**
- expo-updates OTA check disabled (`NEVER`); the embedded-asset path is unchanged and verified.
- Setup screen no longer auto-focuses the name field (the keyboard opened before layout and hid the form).

## Verification

- TypeScript, ESLint, Jest 25/103, `npm audit` 0, Expo Doctor 19/19, native guard.
- Emulator walkthrough (debug over Metro): splash floor → setup → home → 3 products → New bill bottom bar → Find picker (toast, swipe-dismiss) → cart steppers → review → receipt (no scroll) → scanner UI + torch persistence.
- Release APK: manifest lists Inter 400/500/600/700 and Plus Jakarta Sans 600/700/800; cold launch on the emulator; signature unchanged; not debuggable; 16 KB aligned.

## Delivery

Built locally with Gradle (same toolchain as Android Studio), September 16, 2026, 21:43. No EAS.

- **APK for your phone:** `B:\Public Repository\MOB-APP\output\MOPX-2.4.0-local.apk` — 121,044,385 bytes, SHA-256 `46c31bd21971966061ddb0764eb33cda8ea2d9cfe20ca233e8890148af52a684`. Copy of `android\app\build\outputs\apk\release\app-release.apk`. Version 2.4.0 / code 9, installs over 2.3.0 (same certificate).
- **AAB for Play Console:** `B:\Public Repository\MOB-APP\output\MOPX-2.4.0-playstore.aab` — 80,493,178 bytes, SHA-256 `338d6c26b69b0ce0f093e57eece7d3da775f46fb7cd7e60480a7b5779238f045`. Copy of `android\app\build\outputs\bundle\release\app-release.aab`.

Emulator note: the cold launch was captured while the emulator was under memory pressure after the build, so it took ~40 s to reach JS; the splash stayed up the whole time with the same mark, which is the intended slow-device behaviour. On a normal launch the floor is 2 s.
