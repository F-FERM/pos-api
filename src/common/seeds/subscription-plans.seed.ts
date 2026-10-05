import {
  BillingCycle,
  SubscriptionPlanStatus,
} from '../../utils/enums/subscription.enums';

/**
 * Default platform subscription plans.
 *
 * Seeded once at application boot by `SubscriptionPlanService.onModuleInit()`.
 * Idempotent: plans are matched by `code` — existing plans are never overwritten.
 *
 * Conventions:
 *   - Price is stored in MINOR units (paise for INR). ₹999.00 → 99900.
 *   - Limits use -1 = unlimited, 0 = not allowed, positive = hard cap.
 *   - Only ONE plan should have isDefault: true (STARTER).
 *   - Only ONE plan should have trialEnabled: true (STARTER).
 */
export const SUBSCRIPTION_PLANS_SEED = [
  /* ====================================================================
   * STARTER — Free trial, entry-level plan
   * ================================================================= */
  {
    name: 'Starter',
    code: 'STARTER',
    description:
      'Perfect for small shops getting started. Includes core POS, inventory, and 14-day free trial.',
    status: SubscriptionPlanStatus.ACTIVE,
    displayOrder: 1,
    isDefault: true,
    trialEnabled: true,
    trialDays: 14,
    limits: {
      maxUsers: 3,
      maxTerminals: 1,
      maxProducts: 500,
      maxCustomers: 500,
      maxMonthlyTransactions: 2000,
      maxStorageMb: 512,
    },
    features: {
      inventoryEnabled: true,
      multiTerminalEnabled: false,
      barcodeEnabled: true,
      weightedItemsEnabled: false,
      batchTrackingEnabled: false,
      serialTrackingEnabled: false,
      variantsEnabled: false,
      loyaltyEnabled: false,
      taxEnabled: true,
      advancedReportsEnabled: false,
      apiAccessEnabled: false,
      prioritySupportEnabled: false,
    },
    pricing: {
      currency: 'INR',
      priceMinor: 99900, // ₹999.00
      billingCycle: BillingCycle.MONTHLY,
      setupFeeMinor: 0,
      annualDiscountPercent: 0,
    },
    availableCountries: [],
    recommendedForIndustries: ['general_retail', 'dress_shop', 'other'],
    isPublic: true,
  },

  /* ====================================================================
   * GROWTH — Small business standard plan
   * ================================================================= */
  {
    name: 'Growth',
    code: 'GROWTH',
    description:
      'For growing shops with multiple terminals, barcode scanning, and batch/expiry tracking.',
    status: SubscriptionPlanStatus.ACTIVE,
    displayOrder: 2,
    isDefault: false,
    trialEnabled: false,
    trialDays: 0,
    limits: {
      maxUsers: 10,
      maxTerminals: 3,
      maxProducts: 5000,
      maxCustomers: -1,
      maxMonthlyTransactions: 20000,
      maxStorageMb: 5120,
    },
    features: {
      inventoryEnabled: true,
      multiTerminalEnabled: true,
      barcodeEnabled: true,
      weightedItemsEnabled: true,
      batchTrackingEnabled: true,
      serialTrackingEnabled: false,
      variantsEnabled: true,
      loyaltyEnabled: true,
      taxEnabled: true,
      advancedReportsEnabled: true,
      apiAccessEnabled: false,
      prioritySupportEnabled: false,
    },
    pricing: {
      currency: 'INR',
      priceMinor: 249900, // ₹2,499.00
      billingCycle: BillingCycle.MONTHLY,
      setupFeeMinor: 0,
      annualDiscountPercent: 15,
    },
    availableCountries: [],
    recommendedForIndustries: [
      'supermarket',
      'pharmacy',
      'dress_shop',
      'general_retail',
    ],
    isPublic: true,
  },

  /* ====================================================================
   * BUSINESS — Mid-market plan
   * ================================================================= */
  {
    name: 'Business',
    code: 'BUSINESS',
    description:
      'For established retailers with serial/IMEI tracking, multi-terminal operations, and API access.',
    status: SubscriptionPlanStatus.ACTIVE,
    displayOrder: 3,
    isDefault: false,
    trialEnabled: false,
    trialDays: 0,
    limits: {
      maxUsers: 25,
      maxTerminals: 8,
      maxProducts: 50000,
      maxCustomers: -1,
      maxMonthlyTransactions: 100000,
      maxStorageMb: 20480,
    },
    features: {
      inventoryEnabled: true,
      multiTerminalEnabled: true,
      barcodeEnabled: true,
      weightedItemsEnabled: true,
      batchTrackingEnabled: true,
      serialTrackingEnabled: true,
      variantsEnabled: true,
      loyaltyEnabled: true,
      taxEnabled: true,
      advancedReportsEnabled: true,
      apiAccessEnabled: true,
      prioritySupportEnabled: false,
    },
    pricing: {
      currency: 'INR',
      priceMinor: 499900, // ₹4,999.00
      billingCycle: BillingCycle.MONTHLY,
      setupFeeMinor: 0,
      annualDiscountPercent: 20,
    },
    availableCountries: [],
    recommendedForIndustries: [
      'supermarket',
      'electronics',
      'spare_parts',
      'pharmacy',
      'wholesale',
    ],
    isPublic: true,
  },

  /* ====================================================================
   * ENTERPRISE — Top tier, unlimited
   * ================================================================= */
  {
    name: 'Enterprise',
    code: 'ENTERPRISE',
    description:
      'Unlimited scale with priority support, full API access, and every feature enabled.',
    status: SubscriptionPlanStatus.ACTIVE,
    displayOrder: 4,
    isDefault: false,
    trialEnabled: false,
    trialDays: 0,
    limits: {
      maxUsers: -1,
      maxTerminals: -1,
      maxProducts: -1,
      maxCustomers: -1,
      maxMonthlyTransactions: -1,
      maxStorageMb: -1,
    },
    features: {
      inventoryEnabled: true,
      multiTerminalEnabled: true,
      barcodeEnabled: true,
      weightedItemsEnabled: true,
      batchTrackingEnabled: true,
      serialTrackingEnabled: true,
      variantsEnabled: true,
      loyaltyEnabled: true,
      taxEnabled: true,
      advancedReportsEnabled: true,
      apiAccessEnabled: true,
      prioritySupportEnabled: true,
    },
    pricing: {
      currency: 'INR',
      priceMinor: 999900, // ₹9,999.00
      billingCycle: BillingCycle.MONTHLY,
      setupFeeMinor: 0,
      annualDiscountPercent: 25,
    },
    availableCountries: [],
    recommendedForIndustries: [],
    isPublic: true,
  },
];
