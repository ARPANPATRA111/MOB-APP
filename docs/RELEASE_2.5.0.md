# MOPX 2.5.0 (versionCode 12) — release notes and Play Console kit

Built September 19, 2026 on branch `release/2.5.0-billing-polish`. Same upload certificate as 2.3.0–2.4.2 (SHA-256 `a44c115b…`), so the build installs over any earlier MOPX.

## What changed for shopkeepers

**New bill**
- Search inside the bill. A full-width field under the title filters the cart by product name (one typo per word is forgiven: "bnana", "bisuits") or by price ("45", "₹275", or a line total). Results keep the cart's order; nothing is re-sorted.
- Compact two-line cart rows: photo, name and line total on the first line; unit price, remove button and the quantity stepper on the second. A row is about 35% shorter than before, and the remove button and editable quantity are always present. The most recently scanned line is on top.
- While you type (search or a quantity), the bottom action bar steps aside so the lines stay visible; it comes back when the keyboard closes. The row being edited is scrolled into view above the keyboard.
- Header: parked bills icon, then a trash icon to clear the cart (confirmation dialog, disabled when the cart is empty). "Park this bill" is now a small pill on the cart header instead of a list row.
- Long-press a cart thumbnail to see the full photo; it covers the whole screen including the status and navigation bar areas, and stays until you tap outside the photo.

**Add to cart (Find)**
- Products already in the bill get a green outline and a green circle with the quantity in the cart, next to the stock count. Light theme: white number on green; dark theme: black number on bright green.

**Add / edit product**
- Save is light blue (disabled) until Name, Price and In stock are filled, and while a photo is still being compressed — saving during compression used to drop the photo. Tapping the light-blue button explains what is missing.
- A red status line directly above Save names the exact reason a save did not go through, for three seconds ("Price "abc" is not a number. Use digits, e.g. 45 or 45.50.", "This barcode exists…", database errors). It sits in the sticky footer, so it is visible with the keyboard open, unlike the notice at the top of the form. The offending row is highlighted. If the database is busy for more than six seconds the same line says so instead of spinning silently.

**Receipt**
- The shop address and phone number carry a location pin and a phone icon, on screen and in the shared PDF (drawn as inline SVG so they never depend on emoji fonts).

**Whole app**
- On the Home tab, pressing back once shows a small "Press back again to exit" pill above the tab bar; a second press within two seconds closes the app. The pill is inverted against the theme (dark on light, light on dark), like an iOS system HUD. Anywhere else, back behaves as before.
- Disabled filled buttons across the app keep their colour at reduced opacity instead of turning grey.

**Data**
- `docs/samples/MOPX-sample-products.csv`: 65 typical general-store products (grains, dairy, snacks, personal care, vegetables, stationery…) with categories, units, buying costs and low-stock thresholds, in exactly the format Stock → filter → *Import products from CSV* accepts. Barcodes are valid in-store EAN-13 codes (prefix 20), so stickers printed from them scan. A test asserts the file imports without errors.

## Technical notes

- `src/domain/cartSearch.ts` — `filterCartItems`, `withinOneEdit`, `parsePriceQuery` (12 tests).
- `screens/BillingScreen.tsx` — FlatList instead of a mapped ScrollView; rows memoised; `billingSession.updateCart()` applies a pure transform without copying untouched lines so only the edited row re-renders on a 200-line bill.
- `src/hooks/useKeyboardOpen.ts` — keyboard visibility from react-native-keyboard-controller's `will*` events (with `did*` as a safety net); used by the billing footer and the tab bar.
- `src/components/ui/ExitHint.tsx` — Android `BackHandler` guard mounted inside the `NavigationContainer`; only intercepts when `navigationRef.canGoBack()` is false.
- `AppButton` — new `onDisabledPress` prop; disabled filled variants use the base colour at 30% alpha.
- `eas.json` — `appVersionSource: local`, `autoIncrement` removed. `android/app/build.gradle` is the single source of `versionCode`/`versionName` for both Gradle and EAS builds (the EAS remote counter was stale at 6 and would have produced a rejected upload).
- Versions bumped in `app.json` (`version`, `runtimeVersion`), `package.json`, `package-lock.json`, `android/app/build.gradle` (12 / 2.5.0), `android/app/src/main/res/values/strings.xml` (`expo_runtime_version`), `docs/update.json`.

## Verification

- `tsc --noEmit` clean; ESLint 0 problems; Jest 27 suites / 119 tests (baseline was 25 / 103); `npm run check:native` passes.
- Emulator (Pixel 4, API 36) with the debug client, light and dark:
  - Setup → Home → Stock → CSV import of the sample file (65 rows, 0 errors).
  - Find: badges and green outline for in-cart products; quantities update as items are added.
  - New bill: header icons, Park pill → Parked bills → Resume; clear-cart confirmation; search by name, typo, unit price and line total; quantity edit with the keyboard (footer hidden, row scrolled into view); long-press photo preview (tap on photo keeps it, tap outside closes).
  - Add product: light-blue Save with empty form → tap → status line + toast + red rows; camera photo → Save light-blue during compression → full blue after; bad price → status line names the field; corrected → saved.
  - Review & payment → Complete bill → Receipt shows address/phone icons; stock decremented.
  - Home → back once → pill; back twice → app exits.

## Artifacts

| File | Bytes | SHA-256 |
|------|-------|---------|
| `output/MOPX-2.5.0-local.apk` — Gradle, install on your phone | 121,142,309 | `72eec11d760fc27f3fac98d7a8d595309c21c763bdd9fc421a61b4b4ce913d89` |
| `output/MOPX-2.5.0-eas.aab` — EAS Build `fc699ace`, upload to Play Console | 79,980,542 | `bff9763288faddd77ce79864e5ca9c533a7b4ba452be0958ceb94cab9d2da8ab` |
| `output/MOPX-2.5.0-local.aab` — Gradle bundle, fallback only | 80,584,043 | `ebcedfabbbf1d8cda56d49eb43f4ad3fb2c142036eaf036cb5909d4819d3deae` |

Checked on the produced files: package `com.arpanpatra.mopx`, versionCode 12, versionName 2.5.0 in the APK (`aapt dump badging`) and in both AAB manifests; 8 Inter TTF assets in the embedded `app.manifest`; `zipalign -c -P 16 -v 4` passes; every artifact is signed by the upload certificate `A4:4C:11:5B:F1:55:B9:DA:…:1C:D4:3E:3C` (CN=Arpan Patra, OU=MOPX). The EAS build log: https://expo.dev/accounts/arpan111/projects/mob-app/builds/fc699ace-efb3-46c5-8491-6128635166c6. Both AABs carry the same versionCode, so upload only the EAS one.

The release APK was installed on a fresh emulator: cold start with the disc splash, setup, CSV import of the sample file, two bills through Find → Take payment → Complete, receipts with the address/phone icons, Home and Reports reflecting the sales.

## Play Console — steps for this release

1. **Production → Create new release.** Upload `output/MOPX-2.5.0-eas.aab`. Play App Signing re-signs it with the app signing key; the upload key is the one in `mopx-upload-key.jks`.
2. **Release name:** `2.5.0 (12)`.
3. **Release notes (en-IN / en-US, ≤ 500 characters):**

   ```
   • Search inside a bill by product name or price — even with a typo
   • Compact cart rows so long bills stay easy to check
   • See which products are already in the cart, with quantities
   • Clearer product saving: Save unlocks when the form is ready and tells you exactly what is missing
   • Location and phone icons on receipts
   • Press back twice to exit, so a stray tap never closes the app
   ```

4. **Store listing → Main store listing.** Replace the phone screenshots and feature graphic with the files in `docs/play-store/2.5.0/` (listed below). Keep the icon.
5. **Short description (≤ 80 characters):**

   `Offline billing, barcode scanning and stock for small shops. No account needed.`

6. **Full description (≤ 4000 characters):** see below.
7. **App content:** Data safety, content rating, target audience and privacy policy are unchanged from 2.4 (no data collected or shared; camera for barcodes and product photos; all records stay on the phone; optional backups are user-initiated encrypted files).
8. **Roll out:** start at 20% for a day, then 100%. Play's own crash/ANR stats need no SDK.
9. After the release is live, tag the commit (`git tag v2.5.0`) and keep `docs/update.json` at `2.5.0` so older builds show the "Update available" row.

### Full description

```
MOPX is a point-of-sale and stock app for small shops that works completely offline. There is no account, no cloud and no monthly fee — every record stays on your phone.

BILLING
• Scan barcodes continuously to build a bill, or pick products without a barcode from a searchable list
• Search inside a long bill by product name or price, even with a typo
• Compact cart rows with photo, unit price, editable quantity and line total
• Cash, UPI and card splits, change calculation and customer credit with instalments
• Park an unfinished bill and resume it later

STOCK
• Products with photos, categories, units (piece, kg, litre…), buying cost and low-stock alerts
• Import your catalog from a CSV file; print in-store barcode stickers for items that have none
• Purchases, suppliers and a full movement history for every product

RECEIPTS
• Compact receipts with your shop name, address and phone
• Share as PDF, print through Android, or print directly to 58/80 mm thermal printers (Bluetooth or network)

REPORTS
• Daily and weekly sales, top products, profit and inventory value
• Clear graphs, no clutter

SAFE
• Password-encrypted backups, including photos, that you can restore on a new phone
• Works in light and dark theme, three text sizes, keyboard-aware forms
• Nothing leaves the device: no analytics, no accounts, no data collection
```

### Listing assets (`docs/play-store/2.5.0/`)

| File | Size | Use |
|------|------|-----|
| `feature-graphic-1024x500.png` | 1024 × 500 | Feature graphic |
| `phone-01-home-1440x2560.png` | 1440 × 2560 | Phone screenshot 1 |
| `phone-02-bill-1440x2560.png` | 1440 × 2560 | Phone screenshot 2 |
| `phone-03-find-1440x2560.png` | 1440 × 2560 | Phone screenshot 3 |
| `phone-04-stock-1440x2560.png` | 1440 × 2560 | Phone screenshot 4 |
| `phone-05-receipt-1440x2560.png` | 1440 × 2560 | Phone screenshot 5 |
| `phone-06-reports-1440x2560.png` | 1440 × 2560 | Phone screenshot 6 |

Play accepts 2–8 phone screenshots, PNG/JPEG, 320–3840 px on each side; 9:16 at 1080 px or more makes the listing eligible for the larger promotional layout. The screens were captured at 1440 × 3120 / 560 dpi (a current flagship panel: `adb shell wm size 1440x3120`, `wm density 560`, SystemUI demo mode for a clean 10:00 status bar) and framed in a flat-edge, thin-bezel, punch-hole device by `scripts/play-graphics.py`, rendered at 2× and downsampled. Regenerate for the next release with `python scripts/play-graphics.py <dir with home/bill/find/stock/receipt/reports.png> docs/play-store/2.5.0`.
