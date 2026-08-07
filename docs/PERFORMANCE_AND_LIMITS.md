# Performance And Limits

This document records the current local stress checks. These are not lab-grade benchmarks; they are guardrails to keep the offline POS usable as data grows.

## Commands

```bash
npm run test:stress
```

## Latest Local Results

Run date: 2026-07-07

| Case | Size | Result |
| --- | ---: | --- |
| CSV product export/import parser | 5,000 products | Passed in about 27 ms, output about 229,889 chars |
| Report aggregation | 2,000 sales | Passed in about 153 ms |

## Current Practical Limits

- Product search in Billing now uses SQLite-backed search with a default limit of 60 visible products.
- Barcode lookup uses the indexed SQLite barcode path.
- Billing cart totals are memoized and calculated from cart state only.
- Reports still build detailed product/payment/trend insights in JavaScript after loading persisted sales for the selected date range.
- JSON backup and CSV export are currently whole-file exports. They are suitable for MVP use, but very large stores may need streaming/chunked export later.

## Known Bottlenecks

- Reports over very large date ranges may load many sale items into JavaScript.
- Inventory screen still loads the full inventory snapshot for its legacy list path.
- PDF generation for very large bills may be slow or memory-heavy on budget Android phones.
- CSV export builds the full string in memory.
- Camera scanner reliability still needs physical-device testing across Android models.

## Future Optimization Ideas

- Add paginated inventory repository APIs and move Inventory fully to database-backed search.
- Add SQL aggregation queries for report totals, payment breakdown, and top products.
- Add chunked backup/export for very large catalogs.
- Add a dedicated SQLite test harness for repository performance tests.
- Add physical-device timing checks for app startup, billing, receipt PDF, and scanner flow.

## Animation Audit

- Stack headers and card backgrounds now use the active app theme to reduce dark-mode flashing during navigation.
- Report filter changes use in-place content updates and lightweight view bars instead of animated chart libraries.
- Scanner feedback uses a simple toast state instead of layout animation so the camera preview stays stable.
- Large lists avoid animated wrappers.
- Theme switching still depends on persisted theme loading and should be checked on physical devices for any brief startup flash.
