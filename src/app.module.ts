import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { mongooseConnectionString } from './config/config';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CompanyModule } from './company/company.module';
import { PrivilegeModule } from './privilege/privilege.module';
import { PermissionGuard } from './common/guards/permission.guard';
import { ModuleModule } from './module/module.module';
import { SubscriptionPlanModule } from './subscription-plan/subscription-plan.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { CategoryModule } from './category/category.module';
import { BrandModule } from './brand/brand.module';
import { ProductModule } from './product/product.module';
import { SupplierModule } from './supplier/supplier.module';
import { CustomerModule } from './customer/customer.module';
import { RegisterModule } from './register/register.module';
import { SaleModule } from './sale/sale.module';
import { ExpenseModule } from './expense/expense.module';
import { PurchaseModule } from './purchase/purchase.module';
import { NumberSettingsModule } from './number-settings/number-settings.module';

@Module({
  imports: [
    MongooseModule.forRoot(mongooseConnectionString),
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UserModule,
    CompanyModule,
    PrivilegeModule,
    ModuleModule,
    SubscriptionPlanModule,
    SubscriptionModule,
    CategoryModule,
    BrandModule,
    ProductModule,
    SupplierModule,
    CustomerModule,
    RegisterModule,
    SaleModule,
    ExpenseModule,
    PurchaseModule,
    NumberSettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
