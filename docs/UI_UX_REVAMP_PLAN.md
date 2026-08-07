# UI/UX Revamp Plan

The first UI revamp pass is now applied to the core POS workflow after the SQLite/data correctness foundation.

## Direction

- Billing-first workflow.
- Large readable totals.
- Fast product search and barcode/manual fallback.
- Clear stock warnings.
- Clean receipt layout.
- Simple dashboard with today sales, bill count, low stock, and recent sales.
- Light/dark mode with consistent tokens.

## Screen Priorities

- Dashboard: useful store snapshot and quick actions.
- Inventory: search, filters, low-stock badges, edit/delete states.
- Billing: search, scan, cart summary, quantity controls, payment method, duplicate-submit prevention.
- Receipt: saved-sale based receipt with business profile.
- Reports: date filters, payment summary, product movement summary.
- Settings: business profile, backup/restore, migration status, theme.

## Completed In This Pass

- Dashboard, Billing, Receipt, Reports, and Settings were redesigned around production POS tasks.
- Inventory kept its existing list model but now has category chips, clearer stock edit behavior, and required stock adjustment reasons.

## Remaining UI Work

- Product add/edit should move fully onto the shared UI kit.
- Inventory bulk import/restore needs a file picker and validation preview.
- Reports can later add daily closing export and richer date comparison.
- PIN lock and operator switching need a dedicated lightweight flow.

## Rules

- Design for small Android screens and shop usage.
- Avoid decorative clutter.
