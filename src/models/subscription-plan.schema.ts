import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import {
  BillingCycle,
  SubscriptionPlanStatus,
} from '../utils/enums/subscription.enums';

/**
 * Usage limits for a plan.
 * Convention: -1 = unlimited, 0 = feature not allowed, positive = hard cap.
 */
@Schema({ _id: false })
class PlanLimits {
  @Prop({ type: Number, default: 5 })
  maxUsers: number;

  @Prop({ type: Number, default: 1 })
  maxTerminals: number;

  @Prop({ type: Number, default: -1 })
  maxProducts: number;

  @Prop({ type: Number, default: -1 })
  maxCustomers: number;

  @Prop({ type: Number, default: -1 })
  maxMonthlyTransactions: number;

  @Prop({ type: Number, default: -1 })
  maxStorageMb: number;
}

/**
 * Boolean feature toggles bundled with a plan.
 * Must align with CompanyFeatureFlags keys so the plan can drive
 * company-level feature activation on subscription.
 */
@Schema({ _id: false })
class PlanFeatures {
  @Prop({ type: Boolean, default: true })
  inventoryEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  multiTerminalEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  barcodeEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  weightedItemsEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  batchTrackingEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  serialTrackingEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  variantsEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  loyaltyEnabled: boolean;

  @Prop({ type: Boolean, default: true })
  taxEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  advancedReportsEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  apiAccessEnabled: boolean;

  @Prop({ type: Boolean, default: false })
  prioritySupportEnabled: boolean;
}

/**
 * Pricing configuration for a plan.
 * All prices are stored in MINOR currency units (paise / cents) to avoid
 * floating-point precision issues.
 */
@Schema({ _id: false })
class PlanPricing {
  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
    default: 'INR',
  })
  currency: string;

  /** Base price per billing cycle, in minor units. */
  @Prop({ type: Number, required: true, min: 0, default: 0 })
  priceMinor: number;

  @Prop({
    type: String,
    enum: BillingCycle,
    required: true,
    default: BillingCycle.MONTHLY,
  })
  billingCycle: BillingCycle;

  /** Optional one-time setup fee, in minor units. */
  @Prop({ type: Number, default: 0, min: 0 })
  setupFeeMinor: number;

  /** Optional discount applied when the plan is billed annually (0–100). */
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  annualDiscountPercent: number;
}

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

@Schema({ timestamps: true })
export class SubscriptionPlan extends BaseSchema {
  /* ------------------------------ Identity ------------------------------ */

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  code: string; // e.g. "STARTER", "PRO", "ENTERPRISE"

  @Prop({ trim: true, maxlength: 1000 })
  description?: string;

  /* --------------------------- Classification --------------------------- */

  @Prop({
    type: String,
    enum: SubscriptionPlanStatus,
    required: true,
    default: SubscriptionPlanStatus.DRAFT,
  })
  status: SubscriptionPlanStatus;

  /** Sort order for UI display (lower = shown first). */
  @Prop({ type: Number, default: 0 })
  displayOrder: number;

  /** Marks the plan shown to new signups by default. Only ONE should be true. */
  @Prop({ type: Boolean, default: false })
  isDefault: boolean;

  /* ---------------------------- Trial Config ---------------------------- */

  @Prop({ type: Boolean, default: false })
  trialEnabled: boolean;

  @Prop({ type: Number, default: 0, min: 0 })
  trialDays: number;

  /* ------------------------- Limits / Features -------------------------- */

  @Prop({ type: PlanLimits, default: () => ({}), _id: false })
  limits: PlanLimits;

  @Prop({ type: PlanFeatures, default: () => ({}), _id: false })
  features: PlanFeatures;

  /* ------------------------------ Pricing ------------------------------- */

  @Prop({ type: PlanPricing, required: true, default: () => ({}), _id: false })
  pricing: PlanPricing;

  /* ------------------------------ Metadata ------------------------------ */

  /** Null / empty = visible to all countries. Otherwise ISO 3166-1 alpha-2 codes. */
  @Prop({ type: [String], default: [] })
  availableCountries: string[];

  /** Industries this plan is recommended for. Empty = all. */
  @Prop({ type: [String], default: [] })
  recommendedForIndustries: string[];

  /** false = hidden from public pricing page. */
  @Prop({ type: Boolean, default: true })
  isPublic: boolean;

  @Prop({ type: Number, default: 1, min: 1 })
  syncVersion: number;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const SubscriptionPlanSchema =
  SchemaFactory.createForClass(SubscriptionPlan);
export const SubscriptionPlanSchemaName = SubscriptionPlan.name;

SubscriptionPlanSchema.index({ status: 1 });
SubscriptionPlanSchema.index({ code: 1 }, { unique: true });
SubscriptionPlanSchema.index({ isDefault: 1, status: 1 });
SubscriptionPlanSchema.index({ displayOrder: 1 });
SubscriptionPlanSchema.index({ deletedAt: 1 });

export const SubscriptionPlanModelConstants: {
  [K in keyof SubscriptionPlan]: K;
} = {
  name: 'name',
  code: 'code',
  description: 'description',
  status: 'status',
  displayOrder: 'displayOrder',
  isDefault: 'isDefault',
  trialEnabled: 'trialEnabled',
  trialDays: 'trialDays',
  limits: 'limits',
  features: 'features',
  pricing: 'pricing',
  availableCountries: 'availableCountries',
  recommendedForIndustries: 'recommendedForIndustries',
  isPublic: 'isPublic',
  syncVersion: 'syncVersion',
  deletedAt: 'deletedAt',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
