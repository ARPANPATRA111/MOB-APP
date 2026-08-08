export type PlanId = 'free' | 'starter' | 'pro' | 'lifetime';

export interface PlanLimits {
  products: number | 'unlimited';
  billsPerMonth: number | 'unlimited';
}

export interface PlanFeatures {
  basicBilling: boolean;
  basicReports: boolean;
  pdfReceipt: boolean;
  advancedReports: boolean;
  removeInvoiceBranding: boolean;
  csvImportExport: boolean;
  lowStockAlerts: boolean;
  dailyClosingSummary: boolean;
  customerDetails: boolean;
  multiPaymentReports: boolean;
  profitMarginReports: boolean | 'future';
  thermalPrinter: boolean | 'future';
  rolesPin: boolean | 'future';
  gstMode: boolean | 'future';
  cloudBackup: boolean | 'future';
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceHint: string;
  description: string;
  limits: PlanLimits;
  features: PlanFeatures;
}

const baseFeatures: PlanFeatures = {
  basicBilling: true,
  basicReports: true,
  pdfReceipt: true,
  advancedReports: false,
  removeInvoiceBranding: false,
  csvImportExport: false,
  lowStockAlerts: false,
  dailyClosingSummary: false,
  customerDetails: false,
  multiPaymentReports: false,
  profitMarginReports: false,
  thermalPrinter: false,
  rolesPin: false,
  gstMode: false,
  cloudBackup: false,
};

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceHint: 'Rs. 0',
    description: 'A generous offline starter plan for small shops to trust MOPX before paying.',
    limits: { products: 200, billsPerMonth: 300 },
    features: {
      ...baseFeatures,
    },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceHint: 'Rs. 49-99/month or Rs. 499-999/year',
    description: 'For serious shopkeepers who need more capacity and cleaner business documents.',
    limits: { products: 2000, billsPerMonth: 3000 },
    features: {
      ...baseFeatures,
      advancedReports: true,
      removeInvoiceBranding: true,
      csvImportExport: true,
      lowStockAlerts: true,
      dailyClosingSummary: true,
      customerDetails: true,
      multiPaymentReports: true,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceHint: 'Rs. 149-199/month or Rs. 1499-1999/year',
    description: 'For growing shops that need advanced analytics, roles, GST, backup, and printer workflows.',
    limits: { products: 'unlimited', billsPerMonth: 'unlimited' },
    features: {
      ...baseFeatures,
      advancedReports: true,
      removeInvoiceBranding: true,
      csvImportExport: true,
      lowStockAlerts: true,
      dailyClosingSummary: true,
      customerDetails: true,
      multiPaymentReports: true,
      profitMarginReports: true,
      thermalPrinter: 'future',
      rolesPin: 'future',
      gstMode: 'future',
      cloudBackup: 'future',
    },
  },
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime Early Supporter',
    priceHint: 'Rs. 999-2499 one time',
    description: 'A trust-building early adopter option for Indian customers who prefer one-time pricing.',
    limits: { products: 'unlimited', billsPerMonth: 'unlimited' },
    features: {
      ...baseFeatures,
      advancedReports: true,
      removeInvoiceBranding: true,
      csvImportExport: true,
      lowStockAlerts: true,
      dailyClosingSummary: true,
      customerDetails: true,
      multiPaymentReports: true,
      profitMarginReports: 'future',
      thermalPrinter: 'future',
      rolesPin: 'future',
      gstMode: 'future',
      cloudBackup: 'future',
    },
  },
};

export const getPlan = (planId: PlanId = 'free') => PLAN_DEFINITIONS[planId];

export const hasFeatureAccess = (planId: PlanId, feature: keyof PlanFeatures): boolean => {
  const value = getPlan(planId).features[feature];
  return value === true;
};
