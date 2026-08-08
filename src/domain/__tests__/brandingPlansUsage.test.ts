import { APP_FULL_NAME, APP_MEANING, APP_NAME } from '../branding';
import { getPlan, hasFeatureAccess } from '../plans';
import { calculateLimitStatus, getUsageStatuses, shouldShowSoftUpgradePrompt } from '../usageLimits';

describe('MOPX branding and plan rules', () => {
  it('uses MOPX as the customer-facing app name', () => {
    expect(APP_NAME).toBe('MOPX');
    expect(APP_FULL_NAME).toContain('MOPX');
    expect(APP_MEANING).toBe('Mobile Operated POS, extended');
  });

  it('keeps free limits practical and paid plan features gated', () => {
    expect(getPlan('free').limits.products).toBe(200);
    expect(hasFeatureAccess('free', 'removeInvoiceBranding')).toBe(false);
    expect(hasFeatureAccess('starter', 'removeInvoiceBranding')).toBe(true);
    expect(hasFeatureAccess('pro', 'cloudBackup')).toBe(false);
  });

  it('marks near-limit and over-limit usage clearly', () => {
    expect(calculateLimitStatus('products', 160, 200)).toMatchObject({
      nearLimit: true,
      overLimit: false,
      percentUsed: 80,
    });

    expect(calculateLimitStatus('products', 201, 200)).toMatchObject({
      nearLimit: false,
      overLimit: true,
    });

    expect(calculateLimitStatus('products', 5000, 'unlimited')).toMatchObject({
      percentUsed: 0,
      nearLimit: false,
      overLimit: false,
    });
  });

  it('shows soft upgrade prompts only for free plans near limits', () => {
    expect(shouldShowSoftUpgradePrompt('free', { products: 180, billsThisMonth: 50 })).toBe(true);
    expect(shouldShowSoftUpgradePrompt('starter', { products: 1800, billsThisMonth: 50 })).toBe(false);

    expect(getUsageStatuses('free', { products: 10, billsThisMonth: 20 })).toHaveLength(2);
  });
});
