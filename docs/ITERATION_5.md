# Iteration 5 — Add-product stall, images, splash, OTA (2.4.2 / code 11)

Requested September 16, 2026 after phone testing of 2.4.0. Local Gradle builds; no EAS build; no commit/push.

## 1. "Save product is stuck" — what actually happened

I could not reproduce a hang on the emulator (typed barcode, camera photo and crop all saved), so the causes below come from reading the code paths the phone goes through. Three of them are real defects, and all are fixed.

| # | Cause | Effect the user saw | Fix |
|---|-------|---------------------|-----|
| A | `Save` and the photo buttons shared one `useAction` guard. While any photo action was in flight — including an Android crop/camera activity that never returned on some OEM skins — every Save tap was **silently dropped**. | "Sometimes it saves, sometimes it seems to expect an image." | Photo processing has its own state; Save can never be blocked. A photo that finishes after you left the screen is discarded. |
| B | Validation and database errors rendered as a notice at the **top** of the form, which is scrolled away when the keyboard and sticky footer are up. | "It's not moving forward" with no visible reason. | Missing fields turn red with a `*`, the form scrolls to the top, and a toast names them ("Fill the highlighted fields — Name, Price"). Database errors also toast. |
| C | `allowsEditing: true` opened the platform crop screen (unreliable on several OEMs), and `ImageManipulator` decoded the full camera photo (12 MP ≈ 48 MB bitmap). On a low-RAM phone that takes seconds and can get the app killed while the camera is open. | Lag right after adding photographed products; first product after install stalling. | No crop screen; camera capture at `quality 0.6`; main image resized to ≤ 640 px JPEG 0.7 (≈ 40–90 KB) plus a 144 px thumbnail (≈ 5–8 KB). |
| D | Every stock/cart list row decoded the ~800 px photo for a 44 px avatar; each refresh after a save re-decoded 10–20 of them. | Lag growing with the number of photographed products. | Lists and the cart use the thumbnail (fallback to the main file for older photos). |
| — | Global write queue / SQLite exclusive-transaction deadlock (would explain a permanent stall). | — | Audited every `inTransaction` path: all nested calls thread the transaction handle; not the cause. Left as-is. |

Also: scanning a barcode that already exists now opens that product's **edit** screen immediately (with a toast); typing one shows an "Already in stock: … tap to edit" row after 0.5 s, instead of an error at save time. Name, price and in-stock are the only mandatory fields; barcode auto-generates as an in-store EAN-13; the photo is labelled optional.

## 2. Splash screen — why it was cut off / invisible, and the fix

Measured on the emulator: Android drew the native icon at 92 dp wide, the JS overlay drew the same mark at 47 dp, and the two were swapped mid-launch — a visible jump whose size differs per device. OEM launchers also mask Android 12+ splash icons to a circle, and the previous mark relied on `drawable-night` resources being applied for dark mode (not every skin does), which produced black line-art on a black background.

Fix, following Expo's and Android's guidance ([Expo: splash screen and app icon](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/), [expo-splash-screen API](https://docs.expo.dev/versions/latest/sdk/splash-screen/)):
- One icon asset for light and dark: a **filled dark disc (168 dp inside the 288 dp canvas, within the 192 dp safe circle)** with the white/blue mark. It cannot be clipped by circular masks and reads on both backgrounds even if night resources are ignored. Splash background stays theme-coloured.
- **No JS splash overlay.** `SplashScreen.preventAutoHideAsync()` is called at module scope (as recommended) and the native splash is held until fonts, theme and the database are ready **and** 2 s have elapsed since JS started, then `hideAsync()` fades it (350 ms). Slow devices simply see it longer. Verified on the emulator in light and dark: steady for the whole hold, then a single cross-fade into Home.
- `app.json` plugin `imageWidth` set to 288 so a future `expo prebuild` regenerates the same asset.
- The phone screenshots supplied afterwards (2.4.0, Samsung) showed the old JS wordmark clipped to "MOPX" / "Retail POS & Inventor…" and worse in dark mode. That text used positive `letterSpacing`; Android measures such text without the spacing and clips the wider run, and One UI shows it most. The overlay is gone, and `AppText` now drops positive letter spacing on Android everywhere (negative tracking is unaffected) so no other centred label can clip the same way.
- Emulator note: after toggling the system night mode with `cmd uimode`, the emulator's starting window stopped drawing *any* app's splash icon until a reboot; it is not related to the build (verified by reinstalling 2.4.1, then rebooting and seeing the disc again).

## 3. Benchmarks and "device or app?"

`node scripts/test-sqlite.cjs --benchmark` (desktop Node SQLite, synthetic in-memory shop; ms):

| Data: 50,000 products, 20,000 bills/items/payments, 8,000 partly unpaid | ms |
|---|---|
| Stock first page (40 rows) | 5 |
| Search "soap" / price "62" | 8 / 10 |
| Typo search "sopa" (fuzzy fallback) | 39 |
| No-match word (worst case scan) | 113 |
| Credit summary (Home "To collect") | 23 |
| Open credit bills list (100 rows) | 18 |
| Credit search by customer name | 5 |
| Customer search | < 1 |
| Full report (whole history) | 144 |

Phones are typically 3–10× slower than this desktop run (flash storage, slower CPU), so even the worst query lands well under a second at 50k products / 20k bills. **Which matters more:** the app's structure decides whether cost *grows* with data — every list is paged (40/100 rows), every lookup is indexed, reports aggregate in SQL — so the work per screen stays constant as the shop grows. The device decides the constant factor: JS thread speed, storage I/O and, above all, **image decoding** (which is why the thumbnail change matters more on cheap phones than any query). Practical guidance for next steps: data volume is not the limit; if a specific phone still feels slow, it will be rendering/images, and the next lever is a dedicated image library (`expo-image`) with disk caching rather than more SQL work.

## 4. Update checks

- **EAS Update (OTA)** is back on: automatic check at launch (`ON_LOAD`), and Settings → *Check for updates* now runs `Updates.checkForUpdateAsync()` first; if a newer bundle exists it downloads and restarts the app. A published EAS update therefore reaches users either way, as you noted.
- **Store/APK releases** still use `docs/update.json` (bump `latestVersion` when you ship a new build).
- Linking a Play Store release to the button later is straightforward: put the Play listing URL in `update.json`'s `url` so the "Update available" row opens the store.

## 5. Can the app icon be changed from Settings? (answer only, not implemented)

Yes. Android has no native API for it, but the standard technique is one `<activity-alias>` per icon in the manifest, enabling one alias and disabling the others through `PackageManager.setComponentEnabledSetting`; iOS uses `CFBundleAlternateIcons`. In Expo this is packaged as a config plugin + native module, e.g. [expo-alternate-app-icons](https://github.com/pchalupa/expo-alternate-app-icons) or [expo-dynamic-app-icon](https://github.com/Variant-Systems/expo-dynamic-app-icon) (the Flutter plugin you saw does the same alias trick). Caveats to plan for: on Android the switch is applied when the app goes to background and some launchers cache the old icon until restart; every alternative icon must be shipped in the build; Play allows it. Cost is small (a few icon assets + one Settings row) when you want it.

## Verification

- TypeScript, ESLint, Jest 25 suites / 103 tests, `npm audit` 0, native guard, Expo Doctor.
- Emulator, release 2.4.1: cold launch light and dark (disc splash held then faded), Save with empty form → red rows + toast, product with typed barcode saved, camera photo → resized → saved, stock list shows thumbnails.

## Delivery

Built locally with Gradle (same toolchain as Android Studio), September 17, 2026, 00:33. No EAS build.

- **APK for your phone:** `B:\Public Repository\MOB-APP\output\MOPX-2.4.2-local.apk` — 121,131,957 bytes, SHA-256 `d60befaccbc9c19c63d0cafc201ea34195c8f261538a7a0186bbe67cd9da446d`. Version 2.4.2 / code 11, same certificate, installs over 2.3.0/2.4.x.
- **AAB for Play Console:** `B:\Public Repository\MOB-APP\output\MOPX-2.4.2-playstore.aab` — 80,571,227 bytes, SHA-256 `5601ab4d3b653bc02665a02e27db60f57990caa48b5afee95122cac3cd19d50e`.

Verified on the emulator with this exact APK after a reboot: cold launch shows the disc splash steadily (168 dp, no text), then a single fade into Home; fonts (8 TTF assets) in the embedded manifest; signature unchanged; 16 KB aligned; not debuggable.
