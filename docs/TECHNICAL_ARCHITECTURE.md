# Technical Architecture

## Current Layers

- App shell: `App.tsx`, React Navigation stack, theme provider, error boundary.
- Screens: feature UI that calls the compatibility service and domain helpers.
- Domain: pure money, inventory, billing, cart, payment, receipt, report, backup, and validation logic in `src/domain`.
- Database: Expo SQLite setup and migrations in `src/db`.
- Repositories: SQLite data access in `src/repositories`.
- Services: compatibility and migration orchestration in `src/services`.

## Data Direction

SQLite is the source of truth for business data. AsyncStorage is retained only for theme preference and legacy migration compatibility.

## Transaction Rule

New sale creation must occur in one SQLite transaction:

```text
validate cart -> insert sale -> insert sale items -> insert payment -> insert stock movements -> update product stock
```

If any step fails, the entire sale must roll back.

## Future Architecture Direction

Later work should remove the compatibility adapter gradually once every screen can call repositories through focused feature services.

Cloud sync is deliberately not implemented. The schema keeps `sync_status`, timestamps, soft-delete fields, and versions so future sync can be designed without changing every table.

## Native Android Project

The `android/` directory is generated for local Gradle APK builds. Because native folders are present, changes to `app.json` native config must be applied with `npx expo prebuild --platform android` before the next APK build.

Expo Doctor's `appConfigFieldsNotSyncedCheck` is disabled in `package.json` for this local-native workflow. It should be re-enabled if the project returns to a managed/CNG-only workflow without committed native folders.

## UI Foundation

- `AppScreen` owns top safe area, scroll padding, keyboard-aware layout, and bottom footer spacing.
- `BottomActionBar` keeps primary actions above Android gesture navigation.
- Typography tokens live in `src/theme/typography.ts` and are reused by buttons, inputs, stat cards, and screen styles.
- Lightweight chart visuals use React Native views in `InsightBars` to avoid a chart dependency during this hardening pass.

## Performance Direction

- Billing search uses repository-backed SQLite search with a visible result limit.
- Barcode lookup uses the indexed product barcode query.
- Reports still load selected sales into JavaScript for rich insight generation; SQL aggregation is a future optimization.
