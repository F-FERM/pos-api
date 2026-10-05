/* ========================================================================
 * PLAN STATUS — catalog lifecycle
 * ===================================================================== */

export enum SubscriptionPlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/* ========================================================================
 * BILLING CYCLE
 * ===================================================================== */

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
}

/* ========================================================================
 * SUBSCRIPTION STATUS — per-company subscription lifecycle
 * ===================================================================== */

export enum SubscriptionStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

/* ========================================================================
 * SUBSCRIPTION EVENT TYPE — audit trail of subscription changes
 * ===================================================================== */

export enum SubscriptionEventType {
  CREATED = 'created',
  TRIAL_STARTED = 'trial_started',
  TRIAL_CONVERTED = 'trial_converted',
  TRIAL_EXPIRED = 'trial_expired',
  RENEWED = 'renewed',
  UPGRADED = 'upgraded',
  DOWNGRADED = 'downgraded',
  SUSPENDED = 'suspended',
  RESUMED = 'resumed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}
