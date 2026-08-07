# AGENTS.md

## Project Purpose

MOPX is an offline-first React Native/Expo retail POS and inventory app for small vendors and shopkeepers. The revamp goal is a reliable local retail management foundation before advanced features.

## Run The App

```bash
npm install
npm start
npm run android
```

Use `npm run ios` or `npm run web` only when those targets are relevant.

## Run Checks

```bash
npm run typecheck
npm run lint
npm test
npm run doctor
npm run verify
```

## Architecture Rules

- Keep UI, domain logic, repositories, and database migrations separate.
- Put pure business rules in `src/domain`.
- Put SQLite setup and migrations in `src/db`.
- Put data access in `src/repositories`.
- Put orchestration or compatibility services in `src/services`.
- Avoid adding a backend or sync layer before the local offline foundation is stable.

## Storage Rules

- SQLite is the primary store for products, categories, sales, sale items, inventory movements, payments, reports, and audit data.
- AsyncStorage is allowed only for lightweight preferences, onboarding flags, and migration compatibility.
- Never delete legacy AsyncStorage data during migration.
- Sale creation must be transactional.
- Stock changes must go through inventory movement records.

## Testing Rules

- Add tests for domain logic and data migration behavior before changing production workflows.
- Billing totals, stock validation, migration parsing, and sale transactions are critical paths.
- Do not claim coverage that does not exist.

## UI Rules

- Do not redesign the UI until the data layer and billing correctness are stable.
- When UI work begins, design for small Android screens, large touch targets, fast billing, readable totals, and clear empty/error states.
- Avoid decorative clutter.

## Do Not

- Do not run destructive Git commands.
- Do not commit or push unless explicitly asked.
- Do not add cloud sync, backend auth, payment gateway, or enterprise features without approval.
- Do not reintroduce AsyncStorage as the primary business database.
- Do not make fake README claims.

## Definition Of Done

- Relevant checks pass or documented blockers are clear.
- Data migrations are idempotent and non-destructive.
- Existing user data is preserved.
- Critical business logic has tests.
- Changed files are listed in the final response.
