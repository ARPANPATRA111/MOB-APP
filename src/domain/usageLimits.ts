import { getPlan, type PlanId, type PlanLimits } from './plans';

export interface UsageSnapshot {
  products: number;
  billsThisMonth: number;
}

export interface UsageLimitStatus {
  key: keyof PlanLimits;
  used: number;
  limit: number | 'unlimited';
  percentUsed: number;
  nearLimit: boolean;
  overLimit: boolean;
}

export const calculateLimitStatus = (
  key: keyof PlanLimits,
  used: number,
  limit: number | 'unlimited'
): UsageLimitStatus => {
  if (limit === 'unlimited') {
    return { key, used, limit, percentUsed: 0, nearLimit: false, overLimit: false };
  }

  const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 100;
  return {
    key,
    used,
    limit,
    percentUsed,
    nearLimit: percentUsed >= 80 && used <= limit,
    overLimit: used > limit,
  };
};

export const getUsageStatuses = (planId: PlanId, usage: UsageSnapshot): UsageLimitStatus[] => {
  const limits = getPlan(planId).limits;
  return [
    calculateLimitStatus('products', usage.products, limits.products),
    calculateLimitStatus('billsPerMonth', usage.billsThisMonth, limits.billsPerMonth),
  ];
};

export const shouldShowSoftUpgradePrompt = (planId: PlanId, usage: UsageSnapshot): boolean => {
  if (planId !== 'free') {
    return false;
  }
  return getUsageStatuses(planId, usage).some((status) => status.nearLimit || status.overLimit);
};
