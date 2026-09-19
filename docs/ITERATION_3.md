# Design iteration — iOS-style pass, three phases

Requested September 16, 2026 after device testing of 2.2.0. Local Android builds only; no EAS, no commit/push.

## What was actually wrong

Two root causes explained most of the "design not up to the mark" feedback:

1. **Fonts never loaded in the release APK.** expo-updates' `createReleaseUpdatesResources` Gradle task declares no JS/asset inputs, so Gradle reused an `app.manifest` from before Inter was added. The APK contained the fonts, but the embedded asset map did not list them, so `useFonts` failed silently and every screen rendered in Roboto. Because `AppText` maps weight to the Inter family, **no text was bold anywhere**. Fixed in `android/app/build.gradle` (`outputs.upToDateWhen { false }` for `create*UpdatesResources`) and verified from the built APK's manifest.
2. **The native splash still showed the old "MOB" icon** on a mismatched background, then the JS overlay showed a different black-square logo. Regenerated `splashscreen_logo.png` at every density (light and night) from the MOPX line-art with transparency, aligned native/app.json splash colours with the theme, and made the in-app overlay use the same mark with a wordmark ease-in and fade-out.

## Phases

1. **Foundation** — iOS system palette (grouped background, white cards, tint blue, semantic reds/greens) in both themes; compact type scale with Inter tracking and capped accessibility scaling; rebuilt primitives in `CommerceUI` (`Group`/`Panel` inset cards with uppercase group titles and footnotes, `ListRow` with tinted icon wells and inset hairlines, `FormRow` label-left inputs, `SearchField` pill, `Choices` segmented control, `Stat`, `EmptyState`); iOS `AppButton` variants; centred `StackHeader` with tinted back chevron and right items; large-title `TabHeader`; rounded raised tab bar action; bottom-sheet `SelectField` with search; inverted OS bars (dark bars on light theme, light bars on dark) with matching button styles; Settings with segmented Theme/Text size, (i) About in the header, business above tools, backup only in Settings; compact Home with greeting, hero, tiles and grouped receipts; first-run Setup with 56 currencies.
2. **Workflows** — Stock: pill search (name / category / price / typo-tolerant), filter & sort in a bottom sheet behind the header control with removable chips, grouped rows with low/sold-out colouring and image fallback, bottom "Add product" pill, memoized rows with keyset paging. Add/Edit product: photo well (camera / gallery / remove), grouped form rows with currency and unit trailers, one-shot scanner in a compact trailer, optional buying cost / low-stock alert behind a disclosure, archive row. Scanner: full-screen camera with viewfinder corners, torch, two-second read bar, auto-close. Billing: Scan (primary) + Find, grouped cart rows with −/qty/+ stepper and editable quantity, line totals, park/clear rows, sticky total + Take payment above the keyboard. Product picker: full-screen searchable list that keeps adding until Done. Review & payment: items summary, Cash/UPI/Card rows, credit switch, customer and discounts behind disclosures.
3. **Reports & release** — segmented period control, sales hero with average bill and a proper bar chart (nice ceilings, axis labels, weekday/day labels, tooltip bubble), Profit and Received tiles with plain-language captions, payment-mix bar, ranked top products, receipts / unpaid / more-details rows, share PDF in the header. Removed net sales / tax / average from the main view (available under "More details"). Version 2.3.0 / code 8.

## Production checklist

- [x] TypeScript (`tsc --noEmit`) clean.
- [x] ESLint clean (0 errors, 0 warnings).
- [x] Jest: 23 suites / 94 tests pass (chart labels test updated for friendly day labels).
- [x] `npm audit`: 0 advisories (info/low/moderate/high/critical all 0).
- [x] Expo Doctor 19/19.
- [x] Native config guard (`npm run check:native`) passes: version 2.3.0 / runtime 2.3.0 / code 8, `allowBackup=false`, blocked permissions, release signing required.
- [x] Emulator (Android 16, API 36, debug build over Metro) walkthrough with screenshots: first-run setup → Home → Settings (segmented controls, About) → Stock (add 4 products, typo search "saop" → Hand Soap, price search "80" → Tea Box, keyboard never covers the field) → New bill (Find picker with keyboard, add 3 items, stepper and typed quantity recalculates totals, focused row scrolls above the sticky footer) → Review & payment → Receipt → Reports (7-day chart with tooltip, payment mix, top products) → dark theme (light OS bars) → back to Auto.
- [x] Release build regenerates the expo-updates manifest; the built APK's `assets/app.manifest` lists Inter 400/600/700 (26 assets).
- [x] Release APK cold launch on the emulator: native MOPX splash → themed overlay fade → setup; Inter and bold weights render; upgrade-install over the previous release kept the shop profile. Signing certificate unchanged (SHA-256 `a44c115b…`); not debuggable.
- [ ] Physical device: camera focus, scanner timing, OEM keyboards, printer — user acceptance.

## Delivery

Build: `.\android\gradlew.bat -p android :app:assembleRelease` (same toolchain as Android Studio; from Git Bash use `cd android && ./gradlew.bat :app:assembleRelease`). No EAS.

APK: `B:\Public Repository\MOB-APP\output\MOPX-2.3.0-local.apk` (copy of `android\app\build\outputs\apk\release\app-release.apk`). Built September 16, 2026, 18:17. Size 120,728,697 bytes. SHA-256 `457f37faf2c71571ffd35910ea70eb32a6ef355ea3d73f451dfb592da497a8cf`. Version 2.3.0 / code 8, min SDK 24, target SDK 36, ARM64 / ARMv7 / x86 / x86_64.
