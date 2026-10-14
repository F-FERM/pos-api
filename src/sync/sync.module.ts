import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { CompanySchema, CompanySchemaName } from '../models/company.schema';
import { UserSchema, UserSchemaName } from '../models/user.schema';
import {
  StoreLicenseSchema,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import {
  SubscriptionSchema,
  SubscriptionSchemaName,
} from '../models/subscription.schema';
import { ProductSchema, ProductSchemaName } from '../models/product.schema';
import { CustomerSchema, CustomerSchemaName } from '../models/customer.schema';
import { SupplierSchema, SupplierSchemaName } from '../models/supplier.schema';
import { SaleSchema, SaleSchemaName } from '../models/sale.schema';
import {
  SaleReturnSchema,
  SaleReturnSchemaName,
} from '../models/sale-return.schema';
import { PurchaseSchema, PurchaseSchemaName } from '../models/purchase.schema';
import { ExpenseSchema, ExpenseSchemaName } from '../models/expense.schema';
import { AccountSchema, AccountSchemaName } from '../models/account.schema';
import {
  AccountTransactionSchema,
  AccountTransactionSchemaName,
} from '../models/account-transaction.schema';
import {
  RegisterSessionSchema,
  RegisterSessionSchemaName,
} from '../models/register-session.schema';
import {
  DeviceRegistrationSchema,
  DeviceRegistrationSchemaName,
} from '../models/device-registration.schema';
import { EmailOtpSchema, EmailOtpSchemaName } from '../models/email-otp.schema';

import { UnitSchema, UnitSchemaName } from '../models/unit.schema';
import { CategorySchema, CategorySchemaName } from '../models/category.schema';
import { BrandSchema, BrandSchemaName } from '../models/brand.schema';
import { PrinterSchema, PrinterSchemaName } from '../models/printer.schema';
import { CounterSchema, CounterSchemaName } from '../models/counter.schema';

import { CompanyModule } from '../company/company.module';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CompanySchemaName, schema: CompanySchema },
      { name: UserSchemaName, schema: UserSchema },
      { name: StoreLicenseSchemaName, schema: StoreLicenseSchema },
      { name: SubscriptionSchemaName, schema: SubscriptionSchema },
      { name: UnitSchemaName, schema: UnitSchema },
      { name: CategorySchemaName, schema: CategorySchema },
      { name: BrandSchemaName, schema: BrandSchema },
      { name: ProductSchemaName, schema: ProductSchema },
      { name: CustomerSchemaName, schema: CustomerSchema },
      { name: SupplierSchemaName, schema: SupplierSchema },
      { name: SaleSchemaName, schema: SaleSchema },
      { name: SaleReturnSchemaName, schema: SaleReturnSchema },
      { name: PurchaseSchemaName, schema: PurchaseSchema },
      { name: ExpenseSchemaName, schema: ExpenseSchema },
      { name: AccountSchemaName, schema: AccountSchema },
      {
        name: AccountTransactionSchemaName,
        schema: AccountTransactionSchema,
      },
      {
        name: RegisterSessionSchemaName,
        schema: RegisterSessionSchema,
      },
      { name: PrinterSchemaName, schema: PrinterSchema },
      { name: CounterSchemaName, schema: CounterSchema },
      {
        name: DeviceRegistrationSchemaName,
        schema: DeviceRegistrationSchema,
      },
      { name: EmailOtpSchemaName, schema: EmailOtpSchema },
    ]),
    MongooseModule.forFeature(
      [
        { name: CompanySchemaName, schema: CompanySchema },
        { name: UserSchemaName, schema: UserSchema },
        { name: StoreLicenseSchemaName, schema: StoreLicenseSchema },
        { name: SubscriptionSchemaName, schema: SubscriptionSchema },
        { name: UnitSchemaName, schema: UnitSchema },
        { name: CategorySchemaName, schema: CategorySchema },
        { name: BrandSchemaName, schema: BrandSchema },
        { name: ProductSchemaName, schema: ProductSchema },
        { name: CustomerSchemaName, schema: CustomerSchema },
        { name: SupplierSchemaName, schema: SupplierSchema },
        { name: SaleSchemaName, schema: SaleSchema },
        { name: SaleReturnSchemaName, schema: SaleReturnSchema },
        { name: PurchaseSchemaName, schema: PurchaseSchema },
        { name: ExpenseSchemaName, schema: ExpenseSchema },
        { name: AccountSchemaName, schema: AccountSchema },
        {
          name: AccountTransactionSchemaName,
          schema: AccountTransactionSchema,
        },
        {
          name: RegisterSessionSchemaName,
          schema: RegisterSessionSchema,
        },
        { name: PrinterSchemaName, schema: PrinterSchema },
        { name: CounterSchemaName, schema: CounterSchema },
        {
          name: DeviceRegistrationSchemaName,
          schema: DeviceRegistrationSchema,
        },
        { name: EmailOtpSchemaName, schema: EmailOtpSchema },
      ],
      'cloudConnection',
    ),
    forwardRef(() => CompanyModule),
    forwardRef(() => UserModule),
    LogModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
