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
import mongoose, { ClientSession, Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Account,
  AccountCategory,
  AccountDocument,
  AccountModelConstants,
  AccountSchemaName,
  AccountType,
} from '../models/account.schema';
import {
  AccountTransaction,
  AccountTransactionDocument,
  AccountTransactionSchemaName,
  TransactionReferenceType,
  TransactionType,
} from '../models/account-transaction.schema';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import { PaymentMethod, SaleDocument } from '../models/sale.schema';
import { SaleReturnDocument } from '../models/sale-return.schema';
import { PurchaseDocument } from '../models/purchase.schema';
import { ExpenseDocument } from '../models/expense.schema';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateAccountTransactionDto } from './dto/create-account-transaction.dto';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { LogService } from '../log/log.service';
import { NumberSettingsService } from '../number-settings/number-settings.service';
import { AuthedRequest } from '../utils/common.types';
import {
  LogActions,
  LogEntityType,
  LogStatus,
  numberSettingsDocumentType,
} from '../utils/common.enum';
import { Role } from '../utils/role.enum';
import {
  DEFAULT_SYSTEM_ACCOUNTS,
  SystemAccountCode,
} from '../common/seeds/accounts.data';

@Injectable()
export class AccountService
  extends GenericDatabase<Model<AccountDocument>>
  implements OnModuleInit
{
  constructor(
    @InjectModel(AccountSchemaName)
    private readonly accountModel: Model<AccountDocument>,
    @InjectModel(AccountTransactionSchemaName)
    private readonly transactionModel: Model<AccountTransactionDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    @Inject(forwardRef(() => CompanyService))
    private readonly companyService: CompanyService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly logService: LogService,
    private readonly numberSettingsService: NumberSettingsService,
  ) {
    super(accountModel);
  }

  async onModuleInit() {
    await this.seedDefaultAccountsForAllCompanies();
  }

  /**
   * Auto-seed default Chart of Accounts for all existing companies on module startup.
   */
  async seedDefaultAccountsForAllCompanies(): Promise<void> {
    try {
      const companies = await this.companyModel.find({ isDeleted: false });
      for (const comp of companies) {
        const creatorId = comp.ownerId
          ? comp.ownerId.toString()
          : comp.createdBy?.toString() || comp._id.toString();

        await this.createDefaultAccountsForCompany(
          comp._id.toString(),
          creatorId,
        );
      }
    } catch (err) {
      console.error(
        'Failed to auto-seed default accounts for companies:',
        err,
      );
    }
  }

  /**
   * Seed default system Chart of Accounts for a company.
   */
  async createDefaultAccountsForCompany(
    companyId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    const compObjectId = new Types.ObjectId(companyId);
    const userObjectId = new Types.ObjectId(userId);

    for (const accConfig of DEFAULT_SYSTEM_ACCOUNTS) {
      const existing = await this.accountModel.findOne({
        companyId: compObjectId,
        code: accConfig.code,
        isDeleted: false,
      });

      if (!existing) {
        const accountData = {
          code: accConfig.code,
          name: accConfig.name,
          type: accConfig.type,
          category: accConfig.category,
          description: accConfig.description,
          balance: 0,
          isSystemGenerated: true, // System accounts CANNOT be deleted
          isActive: true,
          companyId: compObjectId,
          createdBy: userObjectId,
        };

        if (session) {
          await this.accountModel.create([accountData], { session });
        } else {
          await this.accountModel.create(accountData);
        }
      }
    }
  }

  async createAccount(
    dto: CreateAccountDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      let cleanCode = dto.code?.trim().toUpperCase();

      if (cleanCode) {
        const existing = await this.accountModel.findOne({
          companyId: new Types.ObjectId(companyId),
          code: cleanCode,
          isDeleted: false,
        });

        if (existing) {
          throw new BadRequestException(
            `An account with code '${cleanCode}' already exists in your store`,
          );
        }
      }

      const created = await this.genericCreateOne({
        ...dto,
        code: cleanCode,
        name: dto.name.trim(),
        balance: dto.balance ?? 0,
        isSystemGenerated: false, // User-created custom accounts
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_ACCOUNT,
        entityType: LogEntityType.ACCOUNT,
        entityId: new Types.ObjectId(created._id),
        description: `Account ${created.code} (${created.name}) created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Account created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error creating account');
    }
  }

  async findAllAccounts(
    companyId: string,
    userId: string,
    roles: string[],
    page: number,
    limit: number,
    type?: AccountType,
    search?: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        await this.companyService.validateCompany(companyId, userId);
        filter.companyId = new Types.ObjectId(companyId);
      } else if (companyId) {
        filter.companyId = new Types.ObjectId(companyId);
      }

      if (type) filter.type = type;

      if (search) {
        filter.$or = [
          { code: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.accountModel
          .find(filter)
          .sort({ code: 1 })
          .skip(skip)
          .limit(limit),
        this.accountModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Chart of accounts fetched successfully',
        data,
        pagination: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error fetching chart of accounts');
    }
  }

  async findOneAccount(id: string, companyId: string, userId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const account = await this.accountModel.findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      return {
        success: true,
        message: 'Account details fetched successfully',
        data: account,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error fetching account details');
    }
  }

  async updateAccount(
    id: string,
    dto: UpdateAccountDto,
    companyId: string,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const account = await this.accountModel.findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if (dto.code && dto.code.trim().toUpperCase() !== account.code) {
        if (account.isSystemGenerated) {
          throw new BadRequestException(
            'System account code cannot be modified',
          );
        }
        const dupCode = await this.accountModel.findOne({
          companyId: new Types.ObjectId(companyId),
          code: dto.code.trim().toUpperCase(),
          _id: { $ne: new Types.ObjectId(id) },
          isDeleted: false,
        });
        if (dupCode) {
          throw new BadRequestException('Account code already in use');
        }
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.code && { code: dto.code.trim().toUpperCase() }),
        ...(dto.name && { name: dto.name.trim() }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_ACCOUNT,
        entityType: LogEntityType.ACCOUNT,
        entityId: new Types.ObjectId(id),
        description: `Account ${updated?.code} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Account updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error updating account');
    }
  }

  /**
   * Protected Account Deletion Logic:
   * Prevents deletion of system-generated seeded accounts.
   */
  async deleteAccount(
    id: string,
    companyId: string,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const account = await this.accountModel.findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!account) {
        throw new NotFoundException('Account not found');
      }

      if (account.isSystemGenerated) {
        throw new BadRequestException(
          'System-generated default accounts cannot be deleted by anyone',
        );
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_ACCOUNT,
        entityType: LogEntityType.ACCOUNT,
        entityId: new Types.ObjectId(id),
        description: `Account ${account.code} (${account.name}) deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Custom account deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error deleting account');
    }
  }

  /**
   * Post a single debit or credit entry to an account and update running balance.
   */
  async postEntry(
    companyId: string,
    userId: string,
    accountId: string,
    type: TransactionType,
    amount: number,
    description: string,
    refType: TransactionReferenceType = TransactionReferenceType.MANUAL,
    refId?: Types.ObjectId | null,
    refNumber?: string,
    session?: ClientSession,
  ): Promise<AccountTransactionDocument> {
    if (amount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than zero');
    }

    const compObjId = new Types.ObjectId(companyId);
    const accObjId = new Types.ObjectId(accountId);

    const account = await this.accountModel
      .findOne({
        _id: accObjId,
        companyId: compObjId,
        isDeleted: false,
      })
      .session(session || null);

    if (!account) {
      throw new BadRequestException(`Account ID ${accountId} not found in this company`);
    }

    // Determine balance direction based on Normal Account Types
    // Assets & Expenses increase with DEBIT, decrease with CREDIT
    // Liabilities, Equity, & Income increase with CREDIT, decrease with DEBIT
    const isAssetOrExpense =
      account.type === AccountType.ASSET || account.type === AccountType.EXPENSE;

    const delta = isAssetOrExpense
      ? type === TransactionType.DEBIT
        ? amount
        : -amount
      : type === TransactionType.CREDIT
        ? amount
        : -amount;

    const newBalance = account.balance + delta;

    await this.accountModel.updateOne(
      { _id: accObjId },
      { $set: { balance: newBalance } },
      { session },
    );

    let transactionNumber = `TXN-${Date.now().toString().slice(-6)}`;
    try {
      transactionNumber = await this.numberSettingsService.generateNumber(
        companyId,
        userId,
        numberSettingsDocumentType.ACCOUNT_TRANSACTION,
        session,
      );
    } catch {
      /* Fallback if number setting missing */
    }

    const txnData = {
      transactionNumber,
      accountId: accObjId,
      type,
      amount,
      balanceAfter: newBalance,
      referenceType: refType,
      referenceId: refId || null,
      referenceNumber: refNumber || undefined,
      description,
      transactionDate: new Date(),
      companyId: compObjId,
      createdBy: new Types.ObjectId(userId),
    };

    if (session) {
      const [created] = await this.transactionModel.create([txnData], {
        session,
      });
      return created;
    }

    return await this.transactionModel.create(txnData);
  }

  async recordManualTransaction(
    dto: CreateAccountTransactionDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const txn = await this.postEntry(
        companyId,
        userId,
        dto.accountId,
        dto.type,
        dto.amount,
        dto.description,
        dto.referenceType || TransactionReferenceType.MANUAL,
        null,
        dto.referenceNumber,
      );

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.RECORD_ACCOUNT_TRANSACTION,
        entityType: LogEntityType.ACCOUNT_TRANSACTION,
        entityId: new Types.ObjectId(txn._id),
        description: `Manual ${dto.type} transaction of ${dto.amount} posted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Account transaction posted successfully',
        data: txn,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error recording transaction');
    }
  }

  /**
   * Auto-Journal Posting for POS Sales
   */
  async postSaleJournalEntries(
    sale: SaleDocument,
    companyId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    const compObjId = new Types.ObjectId(companyId);

    const findSystemAccount = async (code: SystemAccountCode) => {
      const acc = await this.accountModel
        .findOne({ companyId: compObjId, code, isDeleted: false })
        .session(session || null);
      if (!acc) {
        await this.createDefaultAccountsForCompany(companyId, userId, session);
        return await this.accountModel
          .findOne({ companyId: compObjId, code, isDeleted: false })
          .session(session || null);
      }
      return acc;
    };

    let paymentAccCode = SystemAccountCode.CASH;
    if (sale.paymentMethod === PaymentMethod.CARD || sale.paymentMethod === PaymentMethod.UPI) {
      paymentAccCode = SystemAccountCode.BANK;
    } else if (sale.paymentMethod === PaymentMethod.CREDIT) {
      paymentAccCode = SystemAccountCode.ACCOUNTS_RECEIVABLE;
    }

    const paymentAccount = await findSystemAccount(paymentAccCode);
    const revenueAccount = await findSystemAccount(SystemAccountCode.SALES_REVENUE);
    const discountAccount = await findSystemAccount(SystemAccountCode.SALES_DISCOUNT_EXPENSE);
    const loyaltyAccount = await findSystemAccount(SystemAccountCode.LOYALTY_EXPENSE);

    // 1. Debit Cash/Bank/Receivable by paid or total amount
    if (paymentAccount && sale.paidAmount > 0) {
      await this.postEntry(
        companyId,
        userId,
        paymentAccount._id.toString(),
        TransactionType.DEBIT,
        sale.paidAmount,
        `POS Sale ${sale.invoiceNumber} (${sale.paymentMethod})`,
        TransactionReferenceType.SALE,
        sale._id,
        sale.invoiceNumber,
        session,
      );
    }

    // 2. Credit Sales Revenue by subtotal + tax
    const totalGrossRevenue = sale.subtotal + sale.taxTotal;
    if (revenueAccount && totalGrossRevenue > 0) {
      await this.postEntry(
        companyId,
        userId,
        revenueAccount._id.toString(),
        TransactionType.CREDIT,
        totalGrossRevenue,
        `Gross Sales Revenue for Invoice ${sale.invoiceNumber}`,
        TransactionReferenceType.SALE,
        sale._id,
        sale.invoiceNumber,
        session,
      );
    }

    // 3. Debit Discounts if discount applied
    if (discountAccount && sale.discountTotal > 0) {
      await this.postEntry(
        companyId,
        userId,
        discountAccount._id.toString(),
        TransactionType.DEBIT,
        sale.discountTotal,
        `Sales Discount on Invoice ${sale.invoiceNumber}`,
        TransactionReferenceType.SALE,
        sale._id,
        sale.invoiceNumber,
        session,
      );
    }

    // 4. Debit Loyalty Expense if loyalty points redeemed
    if (loyaltyAccount && sale.loyaltyDiscountAmount && sale.loyaltyDiscountAmount > 0) {
      await this.postEntry(
        companyId,
        userId,
        loyaltyAccount._id.toString(),
        TransactionType.DEBIT,
        sale.loyaltyDiscountAmount,
        `Loyalty Redemption Expense on Invoice ${sale.invoiceNumber}`,
        TransactionReferenceType.SALE,
        sale._id,
        sale.invoiceNumber,
        session,
      );
    }
  }

  /**
   * Auto-Journal Posting for POS Sale Returns
   */
  async postSaleReturnJournalEntries(
    saleReturn: SaleReturnDocument,
    companyId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    const compObjId = new Types.ObjectId(companyId);

    const findSystemAccount = async (code: SystemAccountCode) => {
      return await this.accountModel
        .findOne({ companyId: compObjId, code, isDeleted: false })
        .session(session || null);
    };

    const revenueAccount = await findSystemAccount(SystemAccountCode.SALES_REVENUE);
    const cashAccount = await findSystemAccount(SystemAccountCode.CASH);

    if (revenueAccount && saleReturn.totalRefundAmount > 0) {
      await this.postEntry(
        companyId,
        userId,
        revenueAccount._id.toString(),
        TransactionType.DEBIT,
        saleReturn.totalRefundAmount,
        `Sales Refund for Return ${saleReturn.returnNumber} (Inv ${saleReturn.invoiceNumber})`,
        TransactionReferenceType.SALE_RETURN,
        saleReturn._id,
        saleReturn.returnNumber,
        session,
      );
    }

    if (cashAccount && saleReturn.totalRefundAmount > 0) {
      await this.postEntry(
        companyId,
        userId,
        cashAccount._id.toString(),
        TransactionType.CREDIT,
        saleReturn.totalRefundAmount,
        `Cash Refund paid out for Return ${saleReturn.returnNumber}`,
        TransactionReferenceType.SALE_RETURN,
        saleReturn._id,
        saleReturn.returnNumber,
        session,
      );
    }
  }

  /**
   * Auto-Journal Posting for Purchases
   */
  async postPurchaseJournalEntries(
    purchase: PurchaseDocument,
    companyId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    const compObjId = new Types.ObjectId(companyId);

    const findSystemAccount = async (code: SystemAccountCode) => {
      return await this.accountModel
        .findOne({ companyId: compObjId, code, isDeleted: false })
        .session(session || null);
    };

    const cogsAccount = await findSystemAccount(SystemAccountCode.COGS_EXPENSE);
    const cashAccount = await findSystemAccount(SystemAccountCode.CASH);
    const payableAccount = await findSystemAccount(SystemAccountCode.ACCOUNTS_PAYABLE);

    // 1. Debit COGS/Purchase Expense for total purchase bill amount
    if (cogsAccount && purchase.totalAmount > 0) {
      await this.postEntry(
        companyId,
        userId,
        cogsAccount._id.toString(),
        TransactionType.DEBIT,
        purchase.totalAmount,
        `Stock Purchase Bill ${purchase.billNumber}`,
        TransactionReferenceType.PURCHASE,
        purchase._id,
        purchase.billNumber,
        session,
      );
    }

    // 2. Credit Cash for paid amount
    if (cashAccount && purchase.paidAmount > 0) {
      await this.postEntry(
        companyId,
        userId,
        cashAccount._id.toString(),
        TransactionType.CREDIT,
        purchase.paidAmount,
        `Cash payment for Purchase Bill ${purchase.billNumber}`,
        TransactionReferenceType.PURCHASE,
        purchase._id,
        purchase.billNumber,
        session,
      );
    }

    // 3. Credit Accounts Payable for due amount
    if (payableAccount && purchase.dueAmount > 0) {
      await this.postEntry(
        companyId,
        userId,
        payableAccount._id.toString(),
        TransactionType.CREDIT,
        purchase.dueAmount,
        `Supplier credit due for Purchase Bill ${purchase.billNumber}`,
        TransactionReferenceType.PURCHASE,
        purchase._id,
        purchase.billNumber,
        session,
      );
    }
  }

  /**
   * Auto-Journal Posting for Expenses
   */
  async postExpenseJournalEntries(
    expense: ExpenseDocument,
    companyId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<void> {
    const compObjId = new Types.ObjectId(companyId);

    const findSystemAccount = async (code: SystemAccountCode) => {
      return await this.accountModel
        .findOne({ companyId: compObjId, code, isDeleted: false })
        .session(session || null);
    };

    const expenseAccount = await findSystemAccount(SystemAccountCode.OPERATING_EXPENSE);
    const cashAccount = await findSystemAccount(SystemAccountCode.CASH);

    if (expenseAccount && expense.amount > 0) {
      await this.postEntry(
        companyId,
        userId,
        expenseAccount._id.toString(),
        TransactionType.DEBIT,
        expense.amount,
        `Store Expense: ${expense.category} - ${expense.description || ''}`,
        TransactionReferenceType.EXPENSE,
        expense._id,
        expense.referenceNo || undefined,
        session,
      );
    }

    if (cashAccount && expense.amount > 0) {
      await this.postEntry(
        companyId,
        userId,
        cashAccount._id.toString(),
        TransactionType.CREDIT,
        expense.amount,
        `Cash payment for ${expense.category}`,
        TransactionReferenceType.EXPENSE,
        expense._id,
        expense.referenceNo || undefined,
        session,
      );
    }
  }

  async getAccountLedger(
    accountId: string,
    companyId: string,
    userId: string,
    page = 1,
    limit = 20,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const filter = {
        companyId: new Types.ObjectId(companyId),
        accountId: new Types.ObjectId(accountId),
        isDeleted: false,
      };

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.transactionModel
          .find(filter)
          .sort({ transactionDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.transactionModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Account ledger transactions fetched successfully',
        data,
        pagination: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error fetching account ledger');
    }
  }

  async getFinancialSummary(companyId: string, userId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const accounts = await this.accountModel.find({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;
      let totalIncome = 0;
      let totalExpenses = 0;

      for (const acc of accounts) {
        if (acc.type === AccountType.ASSET) totalAssets += acc.balance;
        else if (acc.type === AccountType.LIABILITY) totalLiabilities += acc.balance;
        else if (acc.type === AccountType.EQUITY) totalEquity += acc.balance;
        else if (acc.type === AccountType.INCOME) totalIncome += acc.balance;
        else if (acc.type === AccountType.EXPENSE) totalExpenses += acc.balance;
      }

      const netProfit = totalIncome - totalExpenses;

      return {
        success: true,
        message: 'Financial summary calculated successfully',
        data: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          totalIncome,
          totalExpenses,
          netProfit,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw new BadRequestException('Error calculating financial summary');
    }
  }
}
