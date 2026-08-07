# MOB Monetization Plan

MOB should monetize through a generous freemium model. The free version must be genuinely useful so Indian shopkeepers trust the app before paying.

## Free Plan

Suggested limits:

- Up to 200 products.
- Up to 300 bills per month.
- Basic inventory.
- Basic billing.
- Basic PDF receipts.
- Basic reports.
- Local backup/export.
- One business profile.
- One device.
- MOB branding on invoice footer.

## Starter / Plus Plan

Suggested India-friendly pricing:

- Rs. 49/month.
- Rs. 99/month.
- Rs. 499/year.
- Rs. 999/year.

Unlocks:

- Up to 2,000 products.
- Up to 3,000 bills per month.
- Advanced reports.
- Remove MOB branding from invoice.
- Custom invoice footer.
- CSV import/export.
- Advanced backup/restore.
- Low-stock alerts.
- Daily closing summary.
- Customer details on bills.
- Multiple payment mode reports.

## Pro Plan

Suggested pricing:

- Rs. 149/month.
- Rs. 199/month.
- Rs. 1,499/year.
- Rs. 1,999/year.

Unlocks:

- Unlimited or very high products.
- Unlimited billing.
- Advanced analytics.
- Profit/margin reports.
- Multi-user/PIN roles.
- Thermal printer support.
- Supplier/customer ledger.
- GST invoice mode.
- Cloud/Drive backup when implemented.
- Priority support.

## Lifetime Plan

Options:

- Rs. 999 lifetime early adopter.
- Rs. 1,499 lifetime.
- Rs. 2,499 lifetime Pro.

Pros:

- Attractive for Indian users who dislike subscriptions.
- Helps early cash flow and trust.
- Good launch campaign hook.

Cons:

- Can reduce long-term recurring revenue.
- Must clearly define what future cloud costs are excluded from lifetime.
- Should be limited to early users or local launch windows.

## Monetization UX Principles

- Do not block an active bill at checkout.
- Use soft limits and warnings before enforcing.
- Let users finish business-critical work.
- Show "Upgrade later" in prompts.
- Explain business value before price.
- Keep free plan useful enough for real small shops.

## Implementation Plan Later

- Keep plan metadata in `src/domain/plans.ts`.
- Calculate usage in `src/domain/usageLimits.ts`.
- Add usage counters to Settings.
- Add feature flags for premium screens.
- Add server/payment verification only after pricing is validated.
- Avoid local-only fake premium unlocks for production.
