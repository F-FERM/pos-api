import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Expense,
  ExpenseDocument,
  ExpenseSchemaName,
} from '../models/expense.schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class ExpenseService extends GenericDatabase<Model<ExpenseDocument>> {
  constructor(
    @InjectModel(ExpenseSchemaName)
    private readonly expenseModel: Model<ExpenseDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {
    super(expenseModel);
  }

  async createExpense(
    dto: CreateExpenseDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const created = await this.genericCreateOne({
        ...dto,
        category: dto.category.trim(),
        paymentMethod: dto.paymentMethod?.trim() || 'CASH',
        description: dto.description?.trim(),
        referenceNo: dto.referenceNo?.trim(),
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_EXPENSE,
        entityType: LogEntityType.EXPENSE,
        entityId: new Types.ObjectId(created._id),
        description: `Expense ${created.category} (${created.amount}) created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Expense recorded successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_EXPENSE,
        entityType: LogEntityType.EXPENSE,
        entityId: new Types.ObjectId(),
        description: `Failed to create expense`,
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error recording expense');
    }
  }

  async findAllExpenses(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
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

      if (search) {
        filter.$or = [
          { category: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.expenseModel
          .find(filter)
          .populate('createdBy', 'username name')
          .sort({ expenseDate: -1 })
          .skip(skip)
          .limit(limit),
        this.expenseModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Expenses fetched successfully',
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
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching expenses');
    }
  }

  async deleteExpense(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const expense = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!expense) {
        throw new NotFoundException('Expense not found');
      }

      await this.genericUpdateOne(id, {
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_EXPENSE,
        entityType: LogEntityType.EXPENSE,
        entityId: new Types.ObjectId(id),
        description: `Expense ${expense.category} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Expense deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_EXPENSE,
        entityType: LogEntityType.EXPENSE,
        entityId: new Types.ObjectId(id),
        description: `Failed to delete expense`,
        ipAddress,
        path: req.url,
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error deleting expense');
    }
  }
}
