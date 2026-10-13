import {
  BadRequestException,
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import { UserDocument, UserSchemaName } from '../models/user.schema';
import {
  StoreLicenseDocument,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import {
  SubscriptionDocument,
  SubscriptionSchemaName,
} from '../models/subscription.schema';
import { ProductDocument, ProductSchemaName } from '../models/product.schema';
import {
  CustomerDocument,
  CustomerSchemaName,
} from '../models/customer.schema';
import {
  SupplierDocument,
  SupplierSchemaName,
} from '../models/supplier.schema';
import { SaleDocument, SaleSchemaName } from '../models/sale.schema';
import {
  SaleReturnDocument,
  SaleReturnSchemaName,
} from '../models/sale-return.schema';
import {
  PurchaseDocument,
  PurchaseSchemaName,
} from '../models/purchase.schema';
import { ExpenseDocument, ExpenseSchemaName } from '../models/expense.schema';
import { AccountDocument, AccountSchemaName } from '../models/account.schema';
import {
  AccountTransactionDocument,
  AccountTransactionSchemaName,
} from '../models/account-transaction.schema';
import {
  RegisterSessionDocument,
  RegisterSessionSchemaName,
} from '../models/register-session.schema';
import {
  DeviceRegistrationDocument,
  DeviceRegistrationSchemaName,
  DeviceStatus,
} from '../models/device-registration.schema';
import {
  CategoryDocument,
  CategorySchemaName,
} from '../models/category.schema';
import { BrandDocument, BrandSchemaName } from '../models/brand.schema';
import { PrinterDocument, PrinterSchemaName } from '../models/printer.schema';
import { CounterDocument, CounterSchemaName } from '../models/counter.schema';
import { SyncPushDto } from './dto/sync-push.dto';
import { SyncPullDto } from './dto/sync-pull.dto';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { LogService } from '../log/log.service';
import { isCloudOnly } from '../config/config';

@Injectable()
export class SyncService
  extends GenericDatabase<Model<CompanyDocument>>
  implements OnModuleInit
{
  constructor(
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(UserSchemaName)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(StoreLicenseSchemaName)
    private readonly storeLicenseModel: Model<StoreLicenseDocument>,
    @InjectModel(SubscriptionSchemaName)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(CategorySchemaName)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(BrandSchemaName)
    private readonly brandModel: Model<BrandDocument>,
    @InjectModel(ProductSchemaName)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(CustomerSchemaName)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(SupplierSchemaName)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(SaleSchemaName)
    private readonly saleModel: Model<SaleDocument>,
    @InjectModel(SaleReturnSchemaName)
    private readonly saleReturnModel: Model<SaleReturnDocument>,
    @InjectModel(PurchaseSchemaName)
    private readonly purchaseModel: Model<PurchaseDocument>,
    @InjectModel(ExpenseSchemaName)
    private readonly expenseModel: Model<ExpenseDocument>,
    @InjectModel(AccountSchemaName)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(AccountTransactionSchemaName)
    private readonly accountTransactionModel: Model<AccountTransactionDocument>,
    @InjectModel(RegisterSessionSchemaName)
    private readonly registerSessionModel: Model<RegisterSessionDocument>,
    @InjectModel(PrinterSchemaName)
    private readonly printerModel: Model<PrinterDocument>,
    @InjectModel(CounterSchemaName)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(DeviceRegistrationSchemaName)
    private readonly deviceModel: Model<DeviceRegistrationDocument>,

    // Cloud DB Models ('cloudConnection')
    @InjectModel(CompanySchemaName, 'cloudConnection')
    private readonly companyModelCloud: Model<CompanyDocument>,
    @InjectModel(UserSchemaName, 'cloudConnection')
    private readonly userModelCloud: Model<UserDocument>,
    @InjectModel(StoreLicenseSchemaName, 'cloudConnection')
    private readonly storeLicenseModelCloud: Model<StoreLicenseDocument>,
    @InjectModel(SubscriptionSchemaName, 'cloudConnection')
    private readonly subscriptionModelCloud: Model<SubscriptionDocument>,
    @InjectModel(CategorySchemaName, 'cloudConnection')
    private readonly categoryModelCloud: Model<CategoryDocument>,
    @InjectModel(BrandSchemaName, 'cloudConnection')
    private readonly brandModelCloud: Model<BrandDocument>,
    @InjectModel(ProductSchemaName, 'cloudConnection')
    private readonly productModelCloud: Model<ProductDocument>,
    @InjectModel(CustomerSchemaName, 'cloudConnection')
    private readonly customerModelCloud: Model<CustomerDocument>,
    @InjectModel(SupplierSchemaName, 'cloudConnection')
    private readonly supplierModelCloud: Model<SupplierDocument>,
    @InjectModel(SaleSchemaName, 'cloudConnection')
    private readonly saleModelCloud: Model<SaleDocument>,
    @InjectModel(SaleReturnSchemaName, 'cloudConnection')
    private readonly saleReturnModelCloud: Model<SaleReturnDocument>,
    @InjectModel(PurchaseSchemaName, 'cloudConnection')
    private readonly purchaseModelCloud: Model<PurchaseDocument>,
    @InjectModel(ExpenseSchemaName, 'cloudConnection')
    private readonly expenseModelCloud: Model<ExpenseDocument>,
    @InjectModel(AccountSchemaName, 'cloudConnection')
    private readonly accountModelCloud: Model<AccountDocument>,
    @InjectModel(AccountTransactionSchemaName, 'cloudConnection')
    private readonly accountTransactionModelCloud: Model<AccountTransactionDocument>,
    @InjectModel(RegisterSessionSchemaName, 'cloudConnection')
    private readonly registerSessionModelCloud: Model<RegisterSessionDocument>,
    @InjectModel(PrinterSchemaName, 'cloudConnection')
    private readonly printerModelCloud: Model<PrinterDocument>,
    @InjectModel(CounterSchemaName, 'cloudConnection')
    private readonly counterModelCloud: Model<CounterDocument>,
    @InjectModel(DeviceRegistrationSchemaName, 'cloudConnection')
    private readonly deviceModelCloud: Model<DeviceRegistrationDocument>,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    private readonly logService: LogService,
  ) {
    super(companyModel);
  }

  async onModuleInit() {
    if (isCloudOnly) {
      console.log(
        '[MASTER SWITCH] Running in IS_CLOUD_ONLY Development Mode — All database queries read and write directly to Central Cloud MongoDB.',
      );
      return;
    }

    // 10-second background poller to auto-sync unsynced local records to Cloud DB
    setInterval(() => {
      this.syncAllUnsyncedRecords().catch(() => null);
    }, 10000);
  }

  async syncUnsyncedModelRecords(
    localModel: Model<any>,
    cloudModel: Model<any>,
  ): Promise<number> {
    try {
      const unsyncedRecords = await localModel
        .find({
          $or: [{ isSynced: false }, { isSynced: { $exists: false } }],
          isDeleted: false,
        })
        .lean()
        .limit(100);

      if (!unsyncedRecords || unsyncedRecords.length === 0) return 0;

      let syncedCount = 0;
      for (const record of unsyncedRecords) {
        const recordId = record._id;
        const copy = { ...record };
        delete copy._id;
        copy.isSynced = true;
        copy.syncedAt = new Date();

        await cloudModel.updateOne(
          { _id: recordId },
          { $set: copy },
          { upsert: true },
        );

        await localModel.updateOne(
          { _id: recordId },
          { $set: { isSynced: true, syncedAt: copy.syncedAt } },
        );

        if (record.companyId) {
          await this.companyModel.updateOne(
            { _id: record.companyId },
            { $set: { lastSyncedAt: new Date() } },
          );
          await this.companyModelCloud
            .updateOne(
              { _id: record.companyId },
              { $set: { lastSyncedAt: new Date() } },
            )
            .catch(() => null);
        }

        syncedCount++;
      }

      return syncedCount;
    } catch (err) {
      return 0;
    }
  }

  async syncAllUnsyncedRecords(): Promise<Record<string, number>> {
    const summary = {
      users: await this.syncUnsyncedModelRecords(
        this.userModel,
        this.userModelCloud,
      ),
      categories: await this.syncUnsyncedModelRecords(
        this.categoryModel,
        this.categoryModelCloud,
      ),
      brands: await this.syncUnsyncedModelRecords(
        this.brandModel,
        this.brandModelCloud,
      ),
      products: await this.syncUnsyncedModelRecords(
        this.productModel,
        this.productModelCloud,
      ),
      customers: await this.syncUnsyncedModelRecords(
        this.customerModel,
        this.customerModelCloud,
      ),
      suppliers: await this.syncUnsyncedModelRecords(
        this.supplierModel,
        this.supplierModelCloud,
      ),
      sales: await this.syncUnsyncedModelRecords(
        this.saleModel,
        this.saleModelCloud,
      ),
      saleReturns: await this.syncUnsyncedModelRecords(
        this.saleReturnModel,
        this.saleReturnModelCloud,
      ),
      purchases: await this.syncUnsyncedModelRecords(
        this.purchaseModel,
        this.purchaseModelCloud,
      ),
      expenses: await this.syncUnsyncedModelRecords(
        this.expenseModel,
        this.expenseModelCloud,
      ),
      accounts: await this.syncUnsyncedModelRecords(
        this.accountModel,
        this.accountModelCloud,
      ),
      accountTransactions: await this.syncUnsyncedModelRecords(
        this.accountTransactionModel,
        this.accountTransactionModelCloud,
      ),
      registerSessions: await this.syncUnsyncedModelRecords(
        this.registerSessionModel,
        this.registerSessionModelCloud,
      ),
      printers: await this.syncUnsyncedModelRecords(
        this.printerModel,
        this.printerModelCloud,
      ),
      counters: await this.syncUnsyncedModelRecords(
        this.counterModel,
        this.counterModelCloud,
      ),
      deviceRegistrations: await this.syncUnsyncedModelRecords(
        this.deviceModel,
        this.deviceModelCloud,
      ),
    };

    return summary;
  }

  private async upsertEntityList<T>(
    model: Model<any>,
    records: Record<string, any>[] = [],
    companyId: string,
    idKey = '_id',
  ): Promise<number> {
    if (!records || records.length === 0) return 0;

    let processedCount = 0;
    const compObjId = new Types.ObjectId(companyId);

    for (const rawRecord of records) {
      if (!rawRecord) continue;
      const record = { ...rawRecord };

      // Strictly enforce companyId matching for multi-tenant isolation
      record.companyId = compObjId;
      record.isSynced = true;
      record.syncedAt = new Date();

      const recordId = record[idKey]
        ? new Types.ObjectId(record[idKey].toString())
        : new Types.ObjectId();

      delete record._id;

      await model.updateOne(
        { _id: recordId, companyId: compObjId },
        { $set: record },
        { upsert: true },
      );
      processedCount++;
    }

    return processedCount;
  }

  /**
   * Local -> Cloud Push (Upward Sync)
   * Receives modified local records and upserts them into Cloud DB under companyId.
   */
  async pushLocalDataToCloud(
    companyId: string,
    userId: string,
    dto: SyncPushDto,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const pushSummary = {
        companies: await this.upsertEntityList(
          this.companyModelCloud,
          dto.companies,
          companyId,
        ),
        users: await this.upsertEntityList(
          this.userModelCloud,
          dto.users,
          companyId,
        ),
        products: await this.upsertEntityList(
          this.productModelCloud,
          dto.products,
          companyId,
        ),
        customers: await this.upsertEntityList(
          this.customerModelCloud,
          dto.customers,
          companyId,
        ),
        suppliers: await this.upsertEntityList(
          this.supplierModelCloud,
          dto.suppliers,
          companyId,
        ),
        sales: await this.upsertEntityList(
          this.saleModelCloud,
          dto.sales,
          companyId,
        ),
        saleReturns: await this.upsertEntityList(
          this.saleReturnModelCloud,
          dto.saleReturns,
          companyId,
        ),
        purchases: await this.upsertEntityList(
          this.purchaseModelCloud,
          dto.purchases,
          companyId,
        ),
        expenses: await this.upsertEntityList(
          this.expenseModelCloud,
          dto.expenses,
          companyId,
        ),
        accounts: await this.upsertEntityList(
          this.accountModelCloud,
          dto.accounts,
          companyId,
        ),
        accountTransactions: await this.upsertEntityList(
          this.accountTransactionModelCloud,
          dto.accountTransactions,
          companyId,
        ),
        registerSessions: await this.upsertEntityList(
          this.registerSessionModelCloud,
          dto.registerSessions,
          companyId,
        ),
        deviceRegistrations: await this.upsertEntityList(
          this.deviceModelCloud,
          dto.deviceRegistrations,
          companyId,
        ),
      };

      const syncTime = new Date();
      await this.companyModel.updateOne(
        { _id: new Types.ObjectId(companyId) },
        { $set: { lastSyncedAt: syncTime } },
      );
      await this.companyModelCloud
        .updateOne(
          { _id: new Types.ObjectId(companyId) },
          { $set: { lastSyncedAt: syncTime } },
        )
        .catch(() => null);

      return {
        success: true,
        message: 'Local records successfully pushed and synchronized to cloud',
        data: {
          pushSummary,
          serverTime: syncTime,
          lastSyncedAt: syncTime,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error pushing local data to cloud');
    }
  }

  /**
   * Cloud -> Local Pull (Downward Sync)
   * Queries Cloud DB for delta updates modified after lastSyncedAt for companyId.
   */
  async pullCloudDataForCompany(
    companyId: string,
    userId: string,
    dto: SyncPullDto,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const compObjId = new Types.ObjectId(companyId);
      const syncThreshold = dto.lastSyncedAt
        ? new Date(dto.lastSyncedAt)
        : new Date(0);

      const deltaFilter = {
        companyId: compObjId,
        updatedAt: { $gt: syncThreshold },
      };

      const [
        company,
        storeLicense,
        subscription,
        users,
        categories,
        brands,
        products,
        customers,
        suppliers,
        sales,
        saleReturns,
        purchases,
        expenses,
        accounts,
        accountTransactions,
        registerSessions,
        printers,
        counters,
        deviceRegistrations,
      ] = await Promise.all([
        this.companyModelCloud.findOne({
          _id: compObjId,
          updatedAt: { $gt: syncThreshold },
        }),
        this.storeLicenseModelCloud.findOne({
          companyId: compObjId,
          updatedAt: { $gt: syncThreshold },
        }),
        this.subscriptionModelCloud.findOne({
          companyId: compObjId,
          updatedAt: { $gt: syncThreshold },
        }),
        this.userModelCloud.find(deltaFilter),
        this.categoryModelCloud.find(deltaFilter),
        this.brandModelCloud.find(deltaFilter),
        this.productModelCloud.find(deltaFilter),
        this.customerModelCloud.find(deltaFilter),
        this.supplierModelCloud.find(deltaFilter),
        this.saleModelCloud.find(deltaFilter),
        this.saleReturnModelCloud.find(deltaFilter),
        this.purchaseModelCloud.find(deltaFilter),
        this.expenseModelCloud.find(deltaFilter),
        this.accountModelCloud.find(deltaFilter),
        this.accountTransactionModelCloud.find(deltaFilter),
        this.registerSessionModelCloud.find(deltaFilter),
        this.printerModelCloud.find(deltaFilter),
        this.counterModelCloud.find(deltaFilter),
        this.deviceModelCloud.find(deltaFilter),
      ]);

      return {
        success: true,
        message: 'Cloud delta updates retrieved successfully',
        data: {
          serverTime: new Date(),
          delta: {
            company: company || null,
            storeLicense: storeLicense || null,
            subscription: subscription || null,
            users,
            categories,
            brands,
            products,
            customers,
            suppliers,
            sales,
            saleReturns,
            purchases,
            expenses,
            accounts,
            accountTransactions,
            registerSessions,
            printers,
            counters,
            deviceRegistrations,
          },
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error pulling cloud data');
    }
  }

  /**
   * Unified Bi-Directional Sync (Atomic Push + Pull in one request)
   */
  async biDirectionalSync(
    companyId: string,
    userId: string,
    pushDto: SyncPushDto,
    lastSyncedAt?: string,
  ) {
    try {
      const pushRes = await this.pushLocalDataToCloud(
        companyId,
        userId,
        pushDto,
      );
      const pullRes = await this.pullCloudDataForCompany(companyId, userId, {
        lastSyncedAt,
      });

      return {
        success: true,
        message: 'Bi-directional cloud-local sync completed successfully',
        data: {
          pushSummary: pushRes.data.pushSummary,
          serverTime: pullRes.data.serverTime,
          delta: pullRes.data.delta,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error executing bi-directional sync');
    }
  }

  async getSyncStatus(companyId: string, userId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const compObjId = new Types.ObjectId(companyId);

      const [company, license, subscription, userCount, activeDevices] =
        await Promise.all([
          this.companyModel.findOne({ _id: compObjId, isDeleted: false }),
          this.storeLicenseModel.findOne({
            companyId: compObjId,
            isDeleted: false,
          }),
          this.subscriptionModel.findOne({
            companyId: compObjId,
            isDeleted: false,
          }),
          this.userModel.countDocuments({
            companyId: compObjId,
            isDeleted: false,
          }),
          this.deviceModel.countDocuments({
            companyId: compObjId,
            status: DeviceStatus.ACTIVE,
            isDeleted: false,
          }),
        ]);

      return {
        success: true,
        message: 'Sync status and store capacity fetched successfully',
        data: {
          companyId,
          companyName: company?.name || '',
          status: company?.status || '',
          userCapacity: {
            currentUsers: userCount,
            maxUsers: license?.maxUsers || 5,
          },
          counterCapacity: {
            currentCounters: activeDevices,
            maxCounters: license?.maxCounters || 5,
          },
          subscriptionStatus: subscription?.status || 'TRIAL',
          serverTime: new Date(),
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error fetching sync status');
    }
  }
}
