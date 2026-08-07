# MOPX — Play Store Deployment: Single Source of Truth

**Prepared:** 7 August 2026
**App:** MOPX — Retail POS & Inventory
**Package:** `com.arpanpatra.mopx`
**Target:** Closed testing → Production

> **How to use this document.** Everything in a *Answer* block is verified against
> the actual codebase and can be copy-pasted straight into Play Console.
> Everything in **§10 — Your action items** is something only you can do
> (account, hosting, screenshots, legal identity). Work top to bottom.

---

## 1. Readiness status

| Area | Status | Notes |
| --- | --- | --- |
| `npx expo-doctor` | ✅ 18/18 | See §2.1 for the one suppressed check and why |
| `npm run typecheck` | ✅ Pass | |
| `npm run lint` | ✅ Pass | |
| `npm test` | ✅ 77/77 | 17 suites |
| Target API level | ✅ **36** | Play requires ≥ 35; we exceed it |
| Vulnerabilities in shipped app | ✅ **0** | See §2.2 — verified against the actual bundle |
| Signing | ⚠️ **Action needed** | Play App Signing, §10.2 |
| Privacy policy URL | ⚠️ **Action needed** | Text written, needs hosting — §10.3 |
| Store listing graphics | ⚠️ **Action needed** | Specs in §7 |
| Data Safety form | ✅ Pre-answered | §5 |
| Content rating | ✅ Pre-answered | §6 |
| AAB build | ✅ Automated | §9 |

---

## 2. Technical verification (already done)

### 2.1 The one suppressed expo-doctor check — read this

`package.json` disables `appConfigFieldsNotSyncedCheck`. This is **deliberate and
correct**, but you must understand the consequence:

> This project has a **committed `android/` folder**. EAS Build therefore does
> **not** run `prebuild`, which means these `app.json` fields are **ignored at
> build time**: `orientation`, `icon`, `userInterfaceStyle`, `splash`, `ios`,
> `android`, `plugins`, `androidNavigationBar`.

**`android/` is the source of truth, not `app.json`.**

If you ever want to change the app icon, splash screen, orientation, permissions
or version code, edit the native files:

| To change | Edit this |
| --- | --- |
| App icon | `android/app/src/main/res/mipmap-*/` |
| Splash screen | `android/app/src/main/res/values/colors.xml`, `drawable/` |
| Permissions | `android/app/src/main/AndroidManifest.xml` |
| Version code / name | `android/app/build.gradle` (`versionCode`, `versionName`) |
| System bar tints | `android/app/src/main/res/values{,-night}/styles.xml` |

Editing `app.json` alone will silently do nothing. Keeping the doctor check
enabled would fail the build report forever for a condition that is intentional,
which is why it is off.

### 2.2 Vulnerability audit — verified, not assumed

`npm audit` reports 14 advisories (11 moderate, 3 high) in the dependency tree:
`brace-expansion`, `js-yaml`, `shell-quote`, `uuid`. All are
denial-of-service/parsing issues.

**None of them ship in the app.** This was verified, not inferred — by extracting
the Hermes bundle from the built APK and searching it:

```
assets/index.android.bundle: 2.87 MB
  contains 'brace-expansion':      False
  contains 'js-yaml':              False
  contains 'shell-quote':          False
  contains '@expo/config-plugins': False
```

Every chain terminates in build-time tooling that runs on the build machine and
is never bundled: `@expo/cli`, `@expo/xcpretty`, `react-devtools-core`,
`@expo/config-plugins`, `babel-jest`.

**Do not run `npm audit fix --force`.** It would downgrade/upgrade Expo SDK
internals and break the toolchain to fix issues that cannot affect your users.

### 2.3 Verified technical facts

| Field | Value |
| --- | --- |
| Application ID | `com.arpanpatra.mopx` |
| Version name | `2.0.0` |
| Version code | Managed remotely by EAS (`appVersionSource: remote`, auto-increment) |
| Min SDK | 24 (Android 7.0 Nougat) |
| Target SDK | **36** (Android 16) |
| Compile SDK | 36 |
| ABIs | arm64-v8a, armeabi-v7a, x86, x86_64 (AAB splits per device) |
| Orientation | Portrait only |
| Hermes | Enabled |
| Edge-to-edge | Enabled |
| EAS project | `@arpan111/mob-app` (`17cfda77-984c-4ef0-aa9b-5834145c986e`) |
| OTA updates | EAS Update, channel `production` |

### 2.4 Permissions actually shipped (read from the built APK)

| Permission | Level | Why | User-facing prompt |
| --- | --- | --- | --- |
| `CAMERA` | Dangerous | Barcode scanning, product photos | Yes |
| `INTERNET` | Normal | OTA update check only | No |
| `ACCESS_NETWORK_STATE` | Normal | Update check connectivity | No |
| `VIBRATE` | Normal | Scan feedback | No |
| `MODIFY_AUDIO_SETTINGS` | Normal | Scan beep | No |
| `READ/WRITE_EXTERNAL_STORAGE` | Dangerous, capped `maxSdkVersion=32` | Legacy photo picking on Android ≤12 | Yes, on old devices only |

`RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` are explicitly **stripped** from the
merged manifest (`tools:node="remove"`), so library-contributed permissions do
not leak into your listing. There is **no** location, contacts, SMS, or call-log
access.

---

## 3. Play Console — App content questionnaires (copy-paste answers)

### 3.1 App access

> **Answer:** *All functionality is available without special access.*

MOPX has no login, no account, no paywall, and no region lock. Do not provide
test credentials — there are none.

### 3.2 Ads

> **Answer:** **No**, this app does not contain ads.

Verified: no advertising SDK in `package.json`, no ad network code.

### 3.3 Content rating — IARC questionnaire

Category: **Utility, Productivity, Communication, or Other**

| Question | Answer |
| --- | --- |
| Violence | No |
| Sexuality | No |
| Language | No |
| Controlled substances | No |
| Gambling / simulated gambling | No |
| User-generated content sharing | No |
| Users can interact / communicate | No |
| Shares user location | No |
| Allows purchase of digital goods | No |
| Contains sensitive/personal info collection | No |
| Miscellaneous — crude humour, horror, etc. | No |

> **Expected outcome:** Rated **Everyone / PEGI 3 / USK 0**.

### 3.4 Target audience and content

| Field | Answer |
| --- | --- |
| Target age groups | **18 and over** only |
| Appeal to children | **No** |
| Ads shown to children | N/A — no ads |

> Selecting 18+ keeps the app out of the Families programme, which is correct —
> MOPX is a business tool, not a consumer or children's app.

### 3.5 Other declarations

| Declaration | Answer | Reasoning |
| --- | --- | --- |
| News app | **No** | |
| COVID-19 contact tracing / status | **No** | |
| Government app | **No** | |
| **Financial features** | **None of these** | ⚠️ See note below |
| Health apps | **No** | |
| Data safety | See §5 | |

> ⚠️ **Financial features — important.** MOPX records a *payment method label*
> ("Cash", "UPI", "Card") on a bill. It does **not** process payments, connect to
> any payment gateway, hold funds, offer credit, or handle bank data. There is no
> Play Billing integration and no in-app purchase. Answer **"My app doesn't
> provide any financial features."** Answering otherwise triggers a financial
> services review that requires licensing documentation you do not need.

### 3.6 Advertising ID

> **Answer:** **No**, the app does not use an advertising ID.

Do not add the `AD_ID` permission. Nothing in the app reads it.

---

## 4. Store listing copy (ready to paste)

### App name (30 char max)
```
MOPX — Shop Billing & Stock
```
*(27 characters)*

### Short description (80 char max)
```
Offline billing, barcode scanning and stock management for your shop.
```
*(69 characters)*

### Full description (4000 char max)

```
MOPX is a fast, offline point-of-sale and inventory app built for small shops —
kirana stores, stationery shops, hardware stores, boutiques and local
wholesalers.

Everything works without internet. Your data stays on your phone.

BILLING THAT KEEPS UP WITH YOUR COUNTER
• Scan product barcodes with your camera and build a bill in seconds
• Or search by name, browse your catalogue, or type a barcode manually
• Adjust quantities directly — type "100" instead of tapping plus a hundred times
• Apply discounts and tax, then record how the customer paid
• Generate a clean PDF receipt you can print or share on WhatsApp

INVENTORY YOU CAN TRUST
• Add products with name, barcode, price, stock, category and photo
• Search across thousands of products instantly
• Filter by category, stock status, price and more
• Low-stock alerts so you reorder before you run out
• Bulk select and delete

KNOW YOUR NUMBERS
• Today's sales, bill count, items sold and average bill at a glance
• A 7-day revenue chart right on the home screen
• Compare today against yesterday automatically
• Reports for today, last 7 days, this month, or any custom date range
• See your best-selling products and your highest-earning products
• Payment method breakdown
• Export any report as a PDF

BUILT FOR REAL SHOPS
• Works fully offline — no internet, no account, no sign-up
• Your data is stored privately on your device, never uploaded
• Light and dark themes that follow your phone
• Multiple currencies with correct formatting
• Export JSON backups and product CSVs whenever you want
• Add your shop name, address and GSTIN to every receipt

NO ADS. NO TRACKING. NO SUBSCRIPTION.

IMPORTANT — BACK UP YOUR DATA
Because MOPX stores everything on your device and never uploads it, there is no
automatic cloud backup. If you lose or change your phone, your data goes with
it. Please use Settings → Backup your data regularly and keep the file safe.

Questions or feedback: thispc119@gmail.com
```

### Category and tags

| Field | Value |
| --- | --- |
| App category | **Business** |
| Tags | Point of Sale, Inventory, Billing, Small Business, Barcode Scanner |
| Contact email | `thispc119@gmail.com` |
| Website | `https://arpan111.vercel.app/` |
| Phone | Optional — leave blank |

---

## 5. Data Safety form (every field pre-answered)

> This section is the one Google scrutinises most, and a wrong answer here can
> get an app suspended. Every answer below is derived from an actual audit of the
> source: the app makes **zero** outbound requests of its own, and contains no
> analytics, crash-reporting, advertising or tracking SDK.

### 5.1 Overview questions

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data is deleted? | **No** — and select the reason: data is stored only on-device and is deleted by uninstalling |

> **Why "Yes" to collection?** Only because of the EAS Update check, which sends a
> random installation ID. Your business data is *not* collected. Answering "No"
> while the app contacts `u.expo.dev` at launch would be inaccurate.

### 5.2 The only data type to declare

**Device or other IDs → Device or other IDs**

| Field | Answer |
| --- | --- |
| Collected | **Yes** |
| Shared | **No** |
| Processed ephemerally | **No** |
| Required or optional | **Required** |
| Purpose | **App functionality** (only) |

### 5.3 Everything you must leave UNCHECKED

Do **not** tick any of these — none apply:

- Location (approximate or precise)
- Personal info (name, email, address, phone, race, political, religious, orientation, other)
- Financial info (payment info, purchase history, credit score, other)
- Health and fitness
- Messages (emails, SMS, in-app)
- Photos and videos
- Audio files
- Files and docs
- Calendar
- Contacts
- App activity (interactions, search history, installed apps, other actions)
- Web browsing history
- App info and performance (crash logs, diagnostics, other)

> **The subtle one:** MOPX *stores* customer names, phone numbers, photos and
> purchase history — but Google's Data Safety form covers data that is
> **collected (sent off the device) or shared**. Data that never leaves the
> device is explicitly out of scope. Since none of it is transmitted, none of it
> is declared. Your privacy policy (§10.3) explains the on-device storage, which
> is the correct place for it.

### 5.4 Security practices

| Question | Answer |
| --- | --- |
| Data encrypted in transit | **Yes** (HTTPS to `u.expo.dev`) |
| Users can request data deletion | **No** — data is device-local; uninstall deletes it |
| Committed to Play Families Policy | **No** (18+ app) |
| Independent security review | **No** |

---

## 6. Closed testing — the 12 tester / 14 day requirement

> ⚠️ **This is the gate between you and production.** If your Play developer
> account is a **personal/individual** account created after 13 November 2023,
> Google requires:
>
> - **At least 12 testers opted in**, and
> - **continuously opted in for 14 days**, and
> - the test running the whole time
>
> before you can apply for production access. Your "production in 15 days" plan
> works only if the closed test starts **immediately** and you keep 12+ testers
> opted in for the full window. Losing testers mid-way resets your progress.

**Practical advice:**

1. Recruit **15–20 testers**, not 12 — people uninstall, and you need headroom.
2. Use an **email list** in Play Console (simplest) or a Google Group.
3. Every tester must **accept the opt-in link and actually install** the app.
4. Tell testers explicitly: *do not uninstall until told.*
5. Track opt-ins in Play Console → Testing → Closed testing → Testers.
6. After 14 continuous days, Play Console shows an **"Apply for production"**
   button.

**Where organisation accounts differ:** if your developer account is registered
as an organisation, this requirement does not apply and you can go straight to
production. Check Play Console → Settings → Developer account → Account details.

---

## 7. Graphic assets you must produce

| Asset | Spec | Required |
| --- | --- | --- |
| App icon | 512 × 512 PNG, 32-bit, **no transparency** | ✅ Yes |
| Feature graphic | 1024 × 500 PNG/JPG, no transparency | ✅ Yes |
| Phone screenshots | 2–8 images, 16:9 or 9:16, min 320px, max 3840px | ✅ Yes (min 2, use 6–8) |
| 7-inch tablet | 1024 × 600 or similar | Optional |
| 10-inch tablet | 1280 × 800 or similar | Optional |
| Promo video | YouTube URL | Optional |

### Recommended screenshot set (in this order)

1. **Dashboard** with real-looking data — the revenue hero and 7-day chart
2. **Billing scanner** with a product being scanned into the live cart
3. **Inventory list** showing a healthy catalogue with a low-stock badge
4. **Bill review / checkout** with totals and payment method
5. **Receipt** PDF preview
6. **Reports** with the trend chart and top products
7. **Dark mode** version of the dashboard — shows polish
8. **Settings** showing the offline/backup message

> **Do not ship screenshots with empty states or `₹0.00` everywhere.** Seed the
> app with ~20 realistic products and ~15 bills across several days first, so the
> chart and reports look populated.
>
> Capture with `adb exec-out screencap -p > shot1.png` on a clean device
> (full battery icon, no notifications) or use Android Studio's emulator screenshot.

---

## 8. Deployment sequence — do these in order

### Phase A — Before you build (one-time)

1. **Confirm developer account type** — Play Console → Settings → Developer
   account. Personal vs organisation decides whether §6 applies.
2. **Host the privacy policy.** See §10.3. You need a live public URL.
3. **Create the app** in Play Console: *Create app* → name `MOPX`, language
   English (India or US), **App**, **Free**, accept declarations.

### Phase B — Build the AAB

Already automated. From the repo root:

```bash
npx eas-cli build --platform android --profile production
```

This produces an **AAB** (`buildType: app-bundle`), auto-increments the version
code, and returns a download link plus a build page URL.

### Phase C — Play Console setup (use §3–§7 above)

4. **App content** → complete every questionnaire using §3 and §5.
5. **Store listing** → paste copy from §4, upload graphics from §7.
6. **Store settings** → category **Business**, contact details.

### Phase D — Closed testing

7. **Testing → Closed testing → Create track.**
8. Upload the AAB from Phase B.
9. Release name: `2.0.0 (build N)`. Release notes: see §11.
10. Add your tester email list (15–20 people).
11. **Roll out.** Share the opt-in URL with testers.
12. **Wait 14 days** with 12+ testers continuously opted in.

### Phase E — Production

13. Play Console shows **Apply for production**. Apply.
14. Once granted, promote the closed-testing release to Production.
15. Consider a **staged rollout** (20% → 50% → 100%) rather than 100% at once.

---

## 9. The AAB build — what happens

`eas.json` production profile:

```json
"production": {
  "autoIncrement": true,
  "channel": "production",
  "android": { "buildType": "app-bundle" }
}
```

- **`buildType: app-bundle`** → produces `.aab`, which is what Play requires.
- **`autoIncrement: true`** + `appVersionSource: "remote"` → EAS owns the version
  code and bumps it every production build. You never edit it by hand again.
- **`channel: "production"`** → binds the build to the `production` EAS Update
  channel, so `eas update --channel production` reaches these installs.

**Signing:** on the first production build EAS will generate an upload keystore
and store it. See §10.2 — you must download and back it up.

---

## 10. Your action items — only you can do these

### 10.1 Confirm developer account type
Play Console → Settings → Developer account → Account details.
Decides whether the 14-day closed test (§6) is mandatory.

### 10.2 Back up the signing keystore ⚠️ CRITICAL

After the first EAS build:

```bash
npx eas-cli credentials --platform android
```

Choose *Download credentials*. Store the keystore file **and** its passwords
somewhere permanent and private (password manager + an offline copy).

> **Accept Play App Signing on your first upload** (Google offers it, and it is
> mandatory for new apps). It changes the risk profile significantly:
>
> - Google generates and holds the **app signing key** — the one that truly
>   cannot be replaced. It is safe with them.
> - Your keystore becomes the **upload key** only. If you lose it, you can
>   request an upload-key reset through Play Console support and carry on
>   updating the same listing.
>
> So losing this file is a serious inconvenience — a support ticket and a few
> days — not the end of the app. Back it up properly anyway: password manager
> plus one offline copy. Without Play App Signing, losing it *would* be fatal.

### 10.3 Host the privacy policy

`docs/PRIVACY_POLICY.md` is written and ready. It must be reachable at a public
URL. Fastest free option, since you already use GitHub:

1. Copy the file to a `docs/` folder on the `main` branch of a public repo.
2. GitHub repo → **Settings → Pages → Source: main / docs**.
3. Your URL becomes
   `https://arpanpatra111.github.io/<repo>/PRIVACY_POLICY`.
4. Open it in a browser to confirm it loads publicly (log out / use incognito).
5. Paste that URL into Play Console → **App content → Privacy policy**, and into
   **Store listing → Privacy Policy**.

**Verify before submitting.** A privacy policy URL that 404s is one of the most
common rejection reasons.

### 10.4 Produce the graphics
Per §7. This is usually the longest-pole item — start it early.

### 10.5 Recruit testers
15–20 people. Real Google accounts. Brief them not to uninstall.

### 10.6 Decide the countries/regions
Play Console → Production/Closed testing → Countries. Start with India only if
that is your market; you can expand later.

---

## 11. Release notes for the first closed-testing release

```
First closed test of MOPX 2.0.

• Redesigned home screen with a 7-day sales chart and today-vs-yesterday comparison
• New bottom navigation — Home, Stock, New Bill, Reports, Settings
• Multi-currency support with correct Indian lakh/crore formatting
• Pull to refresh on the home screen
• Improved dark mode across the whole app
• Clearer first-run guidance for new shops

Please report anything that looks wrong, especially on the billing screen.
Email: thispc119@gmail.com
```

---

## 12. After launch — pushing fixes

Because EAS Update is now wired up, **JavaScript-only** fixes do not need a new
Play release:

```bash
npx eas-cli update --channel production --message "Fix bill total rounding"
```

Testers/users receive it on next app launch. Use this for UI fixes, copy changes
and JS logic bugs.

**You still need a full rebuild + Play upload for:** native dependency changes,
permission changes, app icon/splash changes, `targetSdk` bumps, or anything under
`android/`.

> **Policy note:** Play permits OTA updates of interpreted code provided they do
> not change the app's purpose or violate policy. Do not use EAS Update to add
> functionality you did not declare — that is a suspension risk.

---

## 13. Common rejection reasons — pre-checked

| Reason | Status |
| --- | --- |
| Privacy policy missing or 404 | ⚠️ You must host it — §10.3 |
| Data Safety form inaccurate | ✅ Pre-answered from source audit — §5 |
| Target API too low | ✅ 36, requirement is 35 |
| Broken/placeholder screenshots | ⚠️ Yours to produce — §7 |
| Requests permissions it doesn't use | ✅ Audited; unused ones stripped |
| Advertising ID declared wrong | ✅ Not used, not declared |
| Crashes on launch | ⚠️ Verify on a real device before uploading |
| Financial features mis-declared | ✅ Answer "none" — §3.5 |
| App name/icon misleading | ✅ Consistent |

---

## 14. Known gaps — deliberate, documented

These are accepted trade-offs, not oversights:

1. **No cloud backup.** `allowBackup="false"`, so shop data does not transfer
   between phones. Chosen deliberately to avoid silently uploading customer names
   and phone numbers to Google Drive. Mitigated by the manual JSON/CSV export and
   an explicit warning in Settings and in the store description.
2. **No account system.** Nothing to recover if the device is lost. Same
   trade-off as above.
3. **UI not yet verified on a physical device.** The tab bar, chart and dark mode
   were built and typechecked but not visually confirmed on hardware. **Do this
   before uploading** — see §7's screenshot list, which doubles as a QA pass.
4. **`plans.ts` / `usageLimits.ts` are unused scaffolding.** No paywall is
   active and no pricing is shown in the UI, so there is no Play Billing
   obligation today. If you ever surface paid tiers in-app, you must use Google
   Play Billing for digital goods.
