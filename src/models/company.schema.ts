import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';
import { BaseSchema } from './common/base.schema';
import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanyOnboardingStep,
  CompanyStatus,
  CompanySubscriptionStatus,
  TimeFormat,
} from '../utils/enums/company.enums';

//company address
@Schema({ _id: false })
class CompanyAddress {
  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  line1: string;

  @Prop({ type: String, trim: true, maxlength: 200 })
  line2?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  city: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  state: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 20 })
  postalCode: string;

  @Prop({
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    match: /^[A-Z]{2}$/,
  })
  country: string;
}

//company tax
@Schema({ _id: false })
class CompanyTaxIdentifiers {
  @Prop({ type: String, trim: true, uppercase: true, maxlength: 50 })
  vatNumber?: string;
}

//contact information
@Schema({ _id: false })
class CompanyContact {
  @Prop({
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 200,
  })
  primaryEmail: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 20 })
  primaryPhone: string;

  @Prop({ type: String, trim: true, maxlength: 20 })
  alternatePhone?: string;

  @Prop({ type: String, trim: true })
  website?: string;
}

//branding information
@Schema({ _id: false })
class CompanyBranding {
  @Prop({ type: String, trim: true })
  logoUrl?: string;

  @Prop({ type: String, trim: true })
  faviconUrl?: string;

  @Prop({
    type: String,
    trim: true,
    match: /^#[0-9A-Fa-f]{6}$/,
  })
  primaryColor?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  receiptFooterText?: string;
}

@Schema({ _id: false })
class CompanyRegionalSettings {
  @Prop({
    type: String,
    required: true,
    default: 'INR',
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
  })
  currency: string;

  @Prop({
    type: String,
    required: true,
    default: '₹',
    trim: true,
    maxlength: 5,
  })
  currencySymbol: string;

  @Prop({ type: String, required: true, default: 'Asia/Kolkata', trim: true })
  timezone: string;

  @Prop({ type: String, required: true, default: 'en-IN', trim: true })
  locale: string;

  @Prop({ type: String, required: true, default: 'DD/MM/YYYY', trim: true })
  dateFormat: string;

  @Prop({
    type: String,
    enum: TimeFormat,
    required: true,
    default: TimeFormat.TWELVE_HOUR,
  })
  timeFormat: TimeFormat;

  @Prop({ type: Number, required: true, min: 1, max: 12, default: 4 })
  fiscalYearStartMonth: number;

  @Prop({ type: Number, default: 100, min: 1 })
  loyaltyAmountPerPoint: number;
}

@Schema({ _id: false })
class CompanyFeatureFlags {
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
}

@Schema({ _id: false })
class CompanySubscriptionSnapshot {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    default: null,
  })
  planId: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  planCode: string | null;

  @Prop({
    type: String,
    enum: CompanySubscriptionStatus,
    default: CompanySubscriptionStatus.NONE,
  })
  status: CompanySubscriptionStatus;

  @Prop({ type: Date, default: null })
  startDate: Date | null;

  @Prop({ type: Date, default: null })
  endDate: Date | null;

  @Prop({ type: Date, default: null })
  trialStartDate: Date | null;

  @Prop({ type: Date, default: null })
  trialEndDate: Date | null;

  @Prop({ type: Number, default: 5, min: 1 })
  maxUsers: number;

  @Prop({ type: Number, default: 1, min: 1 })
  maxTerminals: number;
}

export type CompanyDocument = Company & Document;

@Schema({ timestamps: true, collection: 'companies' })
export class Company extends BaseSchema {
  /* ------------------------------ Identity ------------------------------ */

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  legalName?: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  slug: string;

  /* --------------------------- Classification --------------------------- */

  @Prop({
    type: String,
    enum: CompanyIndustry,
    required: true,
    default: CompanyIndustry.GENERAL_RETAIL,
  })
  industry: CompanyIndustry;

  @Prop({
    type: String,
    enum: CompanyBusinessType,
    required: true,
    default: CompanyBusinessType.RETAIL,
  })
  businessType: CompanyBusinessType;

  @Prop({
    type: String,
    enum: CompanyStatus,
    required: true,
    default: CompanyStatus.PENDING_VERIFICATION,
  })
  status: CompanyStatus;

  @Prop({
    type: String,
    enum: CompanyOnboardingStep,
    required: true,
    default: CompanyOnboardingStep.CREATED,
  })
  onboardingStep: CompanyOnboardingStep;

  /* ------------------------------ Contact ------------------------------- */

  @Prop({ type: CompanyContact, required: true, _id: false })
  contact: CompanyContact;

  /* ------------------------------ Address ------------------------------- */

  @Prop({ type: CompanyAddress, required: true, _id: false })
  address: CompanyAddress;

  /* --------------------------- Tax Identity ----------------------------- */

  @Prop({ type: CompanyTaxIdentifiers, default: {}, _id: false })
  taxIdentifiers: CompanyTaxIdentifiers;

  /* ---------------------------- Regional -------------------------------- */

  @Prop({ type: CompanyRegionalSettings, required: true, _id: false })
  regional: CompanyRegionalSettings;

  /* ----------------------------- Branding ------------------------------- */

  @Prop({ type: CompanyBranding, default: {}, _id: false })
  branding: CompanyBranding;

  /* --------------------------- Feature Flags ---------------------------- */

  @Prop({ type: CompanyFeatureFlags, default: {}, _id: false })
  features: CompanyFeatureFlags;

  /* --------------------------- Subscription ----------------------------- */

  @Prop({
    type: CompanySubscriptionSnapshot,
    required: true,
    default: {},
    _id: false,
  })
  subscription: CompanySubscriptionSnapshot;

  /* -------------------------- Operational Counters ---------------------- */

  @Prop({ type: Number, default: 0, min: 0 })
  currentUserCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  currentTerminalCount: number;

  /* ------------------------------ Owner --------------------------------- */

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  ownerId: Types.ObjectId;

  /* --------------------------- Default Entities ------------------------- */

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Terminal',
    default: null,
  })
  defaultTerminalId: Types.ObjectId | null;

  /* ------------------------------ Metadata ------------------------------ */

  @Prop({ trim: true, maxlength: 500 })
  notes?: string;

  @Prop({ type: Date, default: null })
  suspendedAt?: Date | null;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  suspendedBy?: Types.ObjectId | null;

  @Prop({ trim: true, maxlength: 500 })
  suspensionReason?: string;

  @Prop({ type: Date, default: null })
  activatedAt?: Date | null;

  @Prop({ type: Date, default: null })
  lastActivityAt?: Date | null;

  /* ----------------------- Offline Sync Readiness ----------------------- */

  @Prop({ type: Number, default: 1, min: 1 })
  syncVersion: number;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;
}

export const CompanySchema = SchemaFactory.createForClass(Company);
export const CompanySchemaName = Company.name;

CompanySchema.index({ status: 1 });
CompanySchema.index({ industry: 1 });
CompanySchema.index({ 'subscription.status': 1 });
CompanySchema.index({ createdAt: -1 });
CompanySchema.index({ deletedAt: 1 });

export const CompanyModelConstants: { [K in keyof Company]: K } = {
  // identity
  name: 'name',
  legalName: 'legalName',
  code: 'code',
  slug: 'slug',

  // classification
  industry: 'industry',
  businessType: 'businessType',
  status: 'status',
  onboardingStep: 'onboardingStep',

  // contact / address
  contact: 'contact',
  address: 'address',
  taxIdentifiers: 'taxIdentifiers',

  // regional / branding
  regional: 'regional',
  branding: 'branding',

  // features
  features: 'features',

  // subscription
  subscription: 'subscription',

  // counters
  currentUserCount: 'currentUserCount',
  currentTerminalCount: 'currentTerminalCount',

  // owner & defaults
  ownerId: 'ownerId',
  defaultTerminalId: 'defaultTerminalId',

  // metadata
  notes: 'notes',
  suspendedAt: 'suspendedAt',
  suspendedBy: 'suspendedBy',
  suspensionReason: 'suspensionReason',
  activatedAt: 'activatedAt',
  lastActivityAt: 'lastActivityAt',

  // sync / soft delete
  syncVersion: 'syncVersion',
  deletedAt: 'deletedAt',

  // base
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
};
