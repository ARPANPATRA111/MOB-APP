# Testing Strategy

## Current Test Focus

- Money conversion and totals.
- Product validation.
- Cart stock validation.
- Legacy migration parsers.
- Migration runner ordering.
- Transactional sale success and rollback through a fake database boundary.
- Cart workflow totals, stock enforcement, payment validation.
- Receipt formatting and HTML escaping.
- Sales report aggregation by product/payment.
- Product CSV export/import parsing.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run doctor
npm run verify
npm run test:stress
```

## Next Test Expansion

- Screen-level smoke tests where practical.
- More repository tests with a stable SQLite test harness if available.
- Local APK install smoke on a physical Android device.
- Screen-level interaction tests after a stable React Native testing setup is chosen.

## Rule

Do not claim coverage that has not been measured.
