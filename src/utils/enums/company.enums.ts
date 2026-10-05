/**
 * Vertical / industry of a company.
 *
 * Drives industry-specific feature flags, product fields, and receipt layouts.
 */
export enum CompanyIndustry {
  SUPERMARKET = 'supermarket',
  SPARE_PARTS = 'spare_parts',
  DRESS_SHOP = 'dress_shop',
  PHARMACY = 'pharmacy',
  ELECTRONICS = 'electronics',
  GENERAL_RETAIL = 'general_retail',
  WHOLESALE = 'wholesale',
  OTHER = 'other',
}

/**
 * Business operating model of a company.
 * Affects pricing strategy, tax behaviour, and purchase flow.
 */
export enum CompanyBusinessType {
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
  RETAIL_WHOLESALE = 'retail_wholesale',
  SERVICE = 'service',
}

/**
 * Lifecycle status of a company (tenant).
 *
 * - PENDING_VERIFICATION: registered but not yet approved / verified
 * - ACTIVE:                fully operational, all features enabled
 * - SUSPENDED:             disabled by Super Admin, all access denied
 * - INACTIVE:              voluntarily disabled by the company itself
 */
export enum CompanyStatus {
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

/**
 * Multi-step onboarding progress of a company.
 * Enables resumable registration if a step fails or the user leaves.
 */
export enum CompanyOnboardingStep {
  CREATED = 'created',
  PROFILE_COMPLETED = 'profile_completed',
  PLAN_SELECTED = 'plan_selected',
  COMPLETED = 'completed',
}

/**
 * Subscription lifecycle status of a company.
 *
 * Kept separate from the standalone Subscription document status so the
 * embedded snapshot can evolve independently.
 */
export enum CompanySubscriptionStatus {
  NONE = 'none',
  TRIAL = 'trial',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

/**
 * Time display format used in receipts, invoices, and UI.
 * Kept company-scoped because it lives inside company.regional settings.
 */
export enum TimeFormat {
  TWELVE_HOUR = '12h',
  TWENTY_FOUR_HOUR = '24h',
}
