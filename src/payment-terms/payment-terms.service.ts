import {
  BadRequestException,
  HttpStatus,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, PipelineStage } from 'mongoose';
import { DEFAULT_PAYMENT_TERMS } from 'src/common/seeds/payment-terms.data';
import { CompanyService } from 'src/company/company.service';
import { GenericDatabase } from 'src/helper/genericDatabase';
import {
  PaymentTermDocument,
  PaymentTermSchemaName,
} from 'src/models/payment-terms.schema';
import { UserService } from 'src/user/user.service';
import {
  BulkUpdatePaymentTermDto,
  CreatePaymentTermDto,
  UpdatePaymentTermDto,
} from './dto/create-payment-term.dto';
import { UserDocument } from 'src/models/user.schema';
import { Role } from 'src/utils/role.enum';
import { AuthedRequest } from 'src/utils/common.types';
import { LogService } from 'src/log/log.service';
import { LogActions, LogEntityType, LogStatus } from 'src/utils/common.enum';

@Injectable()
export class PaymentTermsService
  extends GenericDatabase<Model<PaymentTermDocument>>
  implements OnModuleInit
{
  constructor(
    @InjectModel(PaymentTermSchemaName)
    private readonly paymentTermModel: Model<PaymentTermDocument>,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly logService: LogService,
  ) {
    super(paymentTermModel);
  }

  /**
   * Initializes the module by seeding default payment terms.
   */
  async onModuleInit() {
    await this.seedDefaultTerms();
  }

  /**
   * Seeds the database with default payment terms if they do not already exist.
   * These are system-generated and cannot be modified by regular users.
   */
  async seedDefaultTerms() {
    for (const term of DEFAULT_PAYMENT_TERMS) {
      const exist = await this.genericFindOne({ name: term.name });

      if (!exist) {
        await this.genericCreateOne({
          ...term,
          isSystemGenerated: true,
        });
        console.log('Default payment terms seeded successfully');
      }
    }
  }

  /**
   * Creates a new payment term for a specific company.
   *
   * @param dto - Data transfer object containing the details for the new payment term.
   * @param userId - The ID of the user creating the term.
   * @param companyId - The ID of the company the term belongs to.
   * @returns A promise that resolves to an object containing the created payment term data.
   * @throws {BadRequestException} If the payment term name already exists for the company or if the user's branch is not found.
   */
  async create(
    dto: CreatePaymentTermDto | CreatePaymentTermDto[],
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      await this.companyService.validateCompany(companyId, userId);

      const terms = Array.isArray(dto) ? dto : [dto];

      const createdTerms: any[] = [];

      for (const term of terms) {
        const exist = await this.genericFindOne({
          name: term.name,
          companyId,
        });

        if (exist) {
          throw new BadRequestException(
            `Payment term '${term.name}' already exists`,
          );
        }

        const data = await this.genericCreateOne({
          ...term,
          companyId,
          createdBy: userId,
          isSystemGenerated: false,
        });

        createdTerms.push(data);
      }
      await this.logService.createLog({
        companyId: new mongoose.Types.ObjectId(companyId),
        action: LogActions.CREATE_PAYMENT_TERMS,
        entityType: LogEntityType.PAYMENT_TERMS,
        entityId: new mongoose.Types.ObjectId(),
        description: 'Payment term(s) created successfully',
        path: req.url,
        additionalData: {
          newData: createdTerms,
          oldData: null,
        },
        createdBy: new mongoose.Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Payment term(s) created successfully',
        data: createdTerms,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const { userId, companyId: userCompanyId } = req.user;
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      await this.logService.createLog({
        companyId: new mongoose.Types.ObjectId(userCompanyId),
        action: LogActions.CREATE_PAYMENT_TERMS,
        entityType: LogEntityType.PAYMENT_TERMS,
        entityId: new mongoose.Types.ObjectId(),
        description: 'Payment term creation failed',
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
          dto,
        },
        createdBy: new mongoose.Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error while creating payment term', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while creating payment term', error);
      throw new BadRequestException('Error while creating payment term');
    }
  }

  /**
   * Retrieves a paginated list of payment terms, including system-generated and company-specific terms.
   *
   * @param userId - The ID of the user making the request.
   * @param companyId - The ID of the company to retrieve terms for.
   * @param roles - The roles of the user, used to determine access level.
   * @param page - The page number for pagination.
   * @param limit - The number of items per page.
   * @param search - An optional search string to filter terms by name.
   * @returns A promise that resolves to a paginated list of payment terms.
   * @throws {BadRequestException} If there is an error fetching the payment terms.
   */
  async findAll(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
  ) {
    try {
      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      const isSuperAdmin: boolean = roles.includes(Role.superadmin);

      let match: mongoose.QueryFilter<PaymentTermDocument> = {
        isDeleted: false,
      };

      if (isSuperAdmin) {
        match.$or = [
          { isSystemGenerated: true },
          { companyId: new mongoose.Types.ObjectId(companyId) },
        ];
      } else {
        match.$or = [
          { isSystemGenerated: true },
          {
            companyId: new mongoose.Types.ObjectId(companyId),
          },
        ];
      }

      if (search) {
        match = {
          isDeleted: false,
          $and: [
            { $or: match.$or },
            { name: { $regex: search, $options: 'i' } },
          ],
        };
      }

      const skip = (page - 1) * limit;

      const pipeline: PipelineStage[] = [
        { $match: match },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $facet: {
            data: [
              {
                $project: {
                  name: 1,
                  type: 1,
                  numberOfDays: 1,
                  isActive: 1,
                  isSystemGenerated: 1,
                },
              },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [{ $count: 'count' }],
          },
        },
      ];

      const result = await this.paymentTermModel.aggregate(pipeline);

      const data = result[0]?.data ?? [];
      const totalCount = result[0]?.totalCount[0]?.count ?? 0;

      return {
        success: true,
        message: 'Payment terms fetched successfully',
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
        console.log('Error while fetching payment terms', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while fetching payment terms', error);
      throw new BadRequestException('Error while fetching payment terms');
    }
  }

  /**
   * Retrieves a single payment term by its ID.
   *
   * @param id - The unique identifier of the payment term.
   * @param userId - The ID of the user making the request.
   * @param companyId - The ID of the company associated with the user.
   * @param roles - The roles of the user.
   * @returns A promise that resolves to the requested payment term data.
   * @throws {BadRequestException} If the payment term is not found.
   */
  async findOne(
    id: string,
    userId: string,
    companyId: string,
    roles: string[],
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      await this.genericFindOneByIdOrNotFound(id);

      const filter: mongoose.QueryFilter<PaymentTermDocument> = {
        _id: id,
        isDeleted: false,
      };

      const data: PaymentTermDocument | null =
        await this.genericFindOne(filter);

      if (!data) throw new BadRequestException('Payment term not found');

      return {
        success: true,
        message: 'Payment term fetched successfully',
        data,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while fetching payment term', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while fetching payment term', error);
      throw new BadRequestException('Error while fetching payment term');
    }
  }

  /**
   * Updates an existing payment term. System-generated terms cannot be updated.
   *
   * @param id - The unique identifier of the payment term to update.
   * @param dto - Data transfer object containing the fields to update.
   * @param userId - The ID of the user performing the update.
   * @param companyId - The ID of the company the term belongs to.
   * @returns A promise that resolves to the updated payment term data.
   * @throws {BadRequestException} If trying to update a system-generated term, or if the new name already exists.
   */
  async update(
    id: string,
    dto: UpdatePaymentTermDto | BulkUpdatePaymentTermDto[],
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddres: string = await this.getClientIpAddress(req);
      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      if (Array.isArray(dto)) {
        if (!dto.length) {
          throw new BadRequestException('Empty update payload');
        }

        const ids: string[] = dto.map((item) => item._id);

        const terms: PaymentTermDocument[] = await this.paymentTermModel.find({
          _id: { $in: ids },
          companyId,
        });

        if (terms.length !== ids.length) {
          throw new BadRequestException('Some payment terms not found');
        }

        const systemTerm = terms.find((t) => t.isSystemGenerated);
        if (systemTerm) {
          throw new BadRequestException(
            `Cannot update system term '${systemTerm.name}'`,
          );
        }

        const names: string[] = dto
          .map((item) => item.name)
          .filter((name): name is string => !!name);

        if (names.length) {
          const existing: PaymentTermDocument[] =
            await this.paymentTermModel.find({
              name: { $in: names },
              companyId,
              _id: { $nin: ids },
            });

          if (existing.length) {
            const existingNames = existing.map((t) => t.name);
            throw new BadRequestException(
              `Payment term(s) already exist: ${existingNames.join(', ')}`,
            );
          }
        }

        const bulkOps = dto.map((item) => {
          const { _id, ...rest } = item;
          return {
            updateOne: {
              filter: { _id, companyId },
              update: { $set: rest },
            },
          };
        });

        await this.paymentTermModel.bulkWrite(bulkOps);

        const updatedData: PaymentTermDocument[] =
          await this.paymentTermModel.find({
            _id: { $in: ids },
            companyId,
          });

        return {
          success: true,
          message: 'Payment terms updated successfully',
          data: updatedData,
          statusCode: HttpStatus.OK,
        };
      }

      const term: PaymentTermDocument | null = await this.genericFindOne({
        _id: id,
        companyId,
        isSystemGenerated: false,
      });

      if (!term) {
        throw new BadRequestException('Cannot update system term');
      }
      if (dto.name) {
        const exist: PaymentTermDocument | null = await this.genericFindOne({
          name: dto.name,
          companyId,
          _id: { $ne: id },
        });

        if (exist) {
          throw new BadRequestException('Payment term already exists');
        }
      }

      const updated: PaymentTermDocument = await this.genericUpdateOne(id, {
        ...dto,
      });

      await this.logService.createLog({
        companyId: new mongoose.Types.ObjectId(companyId),
        action: LogActions.UPDATE_PAYMENT_TERMS,
        entityType: LogEntityType.PAYMENT_TERMS,
        entityId: new mongoose.Types.ObjectId(id),
        description: 'Payment term updated successfully',
        path: req.url,
        additionalData: {
          oldData: term.toJSON(),
          newData: updated.toJSON(),
        },
        createdBy: new mongoose.Types.ObjectId(userId),
        ipAddress: ipAddres,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Payment term updated',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const { userId, companyId: userCompanyId } = req.user;
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      await this.logService.createLog({
        companyId: new mongoose.Types.ObjectId(userCompanyId),
        action: LogActions.UPDATE_PAYMENT_TERMS,
        entityType: LogEntityType.PAYMENT_TERMS,
        entityId: new mongoose.Types.ObjectId(id),
        description: 'Payment term update failed',
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
          dto,
        },
        createdBy: new mongoose.Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error while updating payment term', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while updating payment term', error);
      throw new BadRequestException('Error while updating payment term');
    }
  }

  /**
   * Deletes a payment term. System-generated terms cannot be deleted.
   *
   * @param id - The unique identifier of the payment term to delete.
   * @param userId - The ID of the user performing the deletion.
   * @param companyId - The ID of the company the term belongs to.
   * @returns A promise that resolves to a success message.
   * @throws {BadRequestException} If trying to delete a system-generated term.
   */
  async delete(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddres: string = await this.getClientIpAddress(req);
      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const term: PaymentTermDocument | null = await this.genericFindOne({
        _id: id,
        companyId,
        isSystemGenerated: false,
      });

      if (!term) throw new BadRequestException('Cannot delete system term');

      await this.genericDeleteOne(id);
      await this.logService.createLog({
        companyId: new mongoose.Types.ObjectId(companyId),
        action: LogActions.DELETE_PAYMENT_TERMS,
        entityType: LogEntityType.PAYMENT_TERMS,
        entityId: new mongoose.Types.ObjectId(id),
        description: 'Payment term deleted successfully',
        path: req.url,
        additionalData: {
          deletedData: term.toJSON(),
        },
        createdBy: new mongoose.Types.ObjectId(userId),
        ipAddress: ipAddres,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const { userId, companyId: userCompanyId } = req.user;
      const ipAddress: string = await this.getClientIpAddress(req);

      const user: UserDocument =
        await this.userService.validateAuthenticatedUser(userId);

      await this.logService.createLog({
        companyId: new mongoose.Types.ObjectId(userCompanyId),
        action: LogActions.DELETE_PAYMENT_TERMS,
        entityType: LogEntityType.PAYMENT_TERMS,
        entityId: new mongoose.Types.ObjectId(id),
        description: 'Payment term deletion failed',
        path: req.url,
        additionalData: {
          error: error instanceof Error ? error.message : error,
        },
        createdBy: new mongoose.Types.ObjectId(userId),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error while deleting payment term', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while deleting payment term', error);
      throw new BadRequestException('Error while deleting payment term');
    }
  }
}
