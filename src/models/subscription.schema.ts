import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import {
  BillingCycle,
  SubscriptionEventType,
  SubscriptionStatus,
} from '../utils/enums/subscription.enums';

/**
 * Snapshot of plan limits at subscription time.
 * Guards read from here, NOT from the live plan doc, so plan changes
 * never silently upgrade an existing customer.
 *
 * Convention: -1 = unlimited, 0 = feature not allowed.
 */
@Schema({ _id: false })
class SubscriptionLimits {
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
 * Current billing period for the subscription.
 * Renewals push this forward and append a SubscriptionEvent.
 */
@Schema({ _id: false })
class SubscriptionPeriod {
  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;
}

/**
 * Single append-only event in the subscription's audit trail.
 * Past events must NEVER be edited — they are the source of truth
 * for how a subscription evolved.
 */
@Schema({ _id: false })
class SubscriptionEvent {
  @Prop({
    type: String,
    enum: SubscriptionEventType,
    required: true,
  })
  type: SubscriptionEventType;

  @Prop({ type: Date, required: true, default: Date.now })
  occurredAt: Date;

  /** Null = system-initiated (e.g. auto-expiry job). */
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  actorId: Types.ObjectId | null;

  /**
   * Snapshot of what was in effect BEFORE the event.
   * Free-form so schema evolution doesn't break past history.
   */
  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  previousState: Record<string, unknown>;

  /**
   * What the event changed to.
   * Free-form for the same reason as previousState.
   */
  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  newState: Record<string, unknown>;

  @Prop({ type: String, trim: true, maxlength: 500 })
  notes?: string;
}

/* ========================================================================
 * MAIN SUBSCRIPTION SCHEMA
 * ===================================================================== */

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true, collection: 'subscriptions' })
export class Subscription extends BaseSchema {
  /* ---------------------------- Tenant Link ----------------------------- */

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  })
  companyId: Types.ObjectId;

  /* ----------------------------- Plan Ref ------------------------------- */

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true,
  })
  planId: Types.ObjectId;

  /** Denormalized snapshot of the plan at subscription time. */
  @Prop({ type: String, required: true, trim: true, uppercase: true })
  planCode: string;

  @Prop({ type: String, required: true, trim: true })
  planName: string;

  /* ------------------------- Lifecycle Status --------------------------- */

  @Prop({
    type: String,
    enum: SubscriptionStatus,
    required: true,
    default: SubscriptionStatus.TRIAL,
    index: true,
  })
  status: SubscriptionStatus;

  /* ------------------------------- Trial -------------------------------- */

  @Prop({ type: Boolean, default: false })
  isTrial: boolean;

  @Prop({ type: Date, default: null })
  trialStartDate: Date | null;

  @Prop({ type: Date, default: null })
  trialEndDate: Date | null;

  /** Set the moment a trial converts to a paid subscription. */
  @Prop({ type: Date, default: null })
  trialConvertedAt: Date | null;

  /* --------------------------- Billing Period --------------------------- */

  /**
   * The current billing period. Renewals push this forward and append
   * a SubscriptionEvent to `events`.
   */
  @Prop({ type: SubscriptionPeriod, required: true, _id: false })
  currentPeriod: SubscriptionPeriod;

  /** Currency snapshot at subscription time (ISO 4217). */
  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
  })
  currency: string;

  @Prop({
    type: String,
    enum: BillingCycle,
    required: true,
    default: BillingCycle.MONTHLY,
  })
  billingCycle: BillingCycle;

  /** Price for this subscription period, in minor units. */
  @Prop({ type: Number, required: true, min: 0, default: 0 })
  priceMinor: number;

  /* ----------------------------- Limits Snapshot ------------------------ */

  /**
   * Snapshot of plan limits at subscription time.
   * Guards read from here (fast) — NOT from the live plan doc.
   * If the plan changes, an upgrade/downgrade creates a new Subscription.
   */
  @Prop({
    type: SubscriptionLimits,
    required: true,
    default: () => ({}),
    _id: false,
  })
  limits: SubscriptionLimits;

  /* ---------------------------- Auto-Renew ------------------------------ */

  @Prop({ type: Boolean, default: true })
  autoRenew: boolean;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ type: Date, default: null })
  suspendedAt: Date | null;

  @Prop({ type: Date, default: null })
  resumedAt: Date | null;

  @Prop({ type: Date, default: null })
  expiredAt: Date | null;

  /* ------------------------------ History ------------------------------- */

  /**
   * Append-only event log for this subscription.
   * Never edit past events — they are the audit trail.
   */
  @Prop({ type: [SubscriptionEvent], default: [] })
  events: SubscriptionEvent[];

  /* ------------------------------ Metadata ------------------------------ */

  /** External payment provider reference (Stripe sub ID, Razorpay sub ID, etc.). */
  @Prop({ type: String, trim: true, default: null })
  externalProviderId: string | null;

  @Prop({ type: String, trim: true, default: null })
  externalProviderName: string | null;

  @Prop({ type: String, trim: true, maxlength: 500 })
  cancellationReason?: string;

  @Prop({ type: Number, default: 1, min: 1 })
  syncVersion: number;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
export const SubscriptionSchemaName = Subscription.name;

SubscriptionSchema.index({ companyId: 1, status: 1 });
SubscriptionSchema.index({ companyId: 1, createdAt: -1 });
SubscriptionSchema.index({ status: 1, 'currentPeriod.endDate': 1 });
SubscriptionSchema.index({ trialEndDate: 1 }, { sparse: true });
SubscriptionSchema.index({ planId: 1 });
SubscriptionSchema.index({ deletedAt: 1 });

export const SubscriptionModelConstants: { [K in keyof Subscription]: K } = {
  companyId: 'companyId',
  planId: 'planId',
  planCode: 'planCode',
  planName: 'planName',
  status: 'status',
  isTrial: 'isTrial',
  trialStartDate: 'trialStartDate',
  trialEndDate: 'trialEndDate',
  trialConvertedAt: 'trialConvertedAt',
  currentPeriod: 'currentPeriod',
  currency: 'currency',
  billingCycle: 'billingCycle',
  priceMinor: 'priceMinor',
  limits: 'limits',
  autoRenew: 'autoRenew',
  cancelledAt: 'cancelledAt',
  suspendedAt: 'suspendedAt',
  resumedAt: 'resumedAt',
  expiredAt: 'expiredAt',
  events: 'events',
  externalProviderId: 'externalProviderId',
  externalProviderName: 'externalProviderName',
  cancellationReason: 'cancellationReason',
  syncVersion: 'syncVersion',
  deletedAt: 'deletedAt',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
