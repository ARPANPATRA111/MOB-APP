# Bottlenecks And Next Features

## Current Bottlenecks

- SQLite migration edge cases: legacy AsyncStorage payloads can be malformed, partially missing, or duplicated. The migration is defensive, but real-device legacy data still needs QA.
- Large product database: Billing search now uses indexed SQLite search, but Inventory still has legacy full-list behavior.
- Large bill history: Reports load sale records for the selected range before building insights.
- Report aggregation performance: current charts are lightweight React Native views, but aggregation is still mostly JavaScript-side.
- PDF generation with huge bills: Expo Print can handle normal receipts, but very large item tables may be slow on budget phones.
- Backup/restore memory usage: JSON and CSV export are whole-file operations.
- Camera scanner reliability: scanner UX is improved, but camera behavior must be tested on physical Android devices.
- Device safe-area issues: shared wrappers now account for top/bottom safe areas, but cutouts and vendor skins still need manual QA.
- Keyboard handling: AppScreen supports keyboard-aware layouts, but Add Product still has some legacy form structure.
- App startup time: migrations and legacy migration run at startup through the storage adapter.
- Native Android build/config drift: because `android/` exists, `app.json` native config changes require rerunning prebuild.
- Release signing: release APK currently uses the generated debug keystore and is not Play Store ready.
- Play Store readiness: no proper signed release, store listing, privacy policy, or internal testing track setup yet.
- Physical device QA: no authorized device was available in this session.

## Suggested Next-Version Features

These are future suggestions, not current implemented features.

- Proper release signing and keystore management.
- Play Store internal testing setup.
- Cloud backup.
- Google Drive backup.
- Multi-device sync with conflict resolution.
- GST-ready invoice mode.
- Hindi/English language support.
- Customer ledger.
- Supplier/vendor ledger.
- Expense tracking.
- Profit and margin reports.
- Purchase stock entry.
- Return/refund flow.
- Bluetooth thermal printer support.
- Role/PIN permissions.
- Data import wizard with validation preview.
- Better onboarding and sample demo data mode.
- App crash reporting.
- Local encrypted backup.
- Store logo upload.
- Multi-store support later.
