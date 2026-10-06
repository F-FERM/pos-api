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
  RegisterSession,
  RegisterSessionDocument,
  RegisterSessionModelConstants,
  RegisterSessionSchemaName,
  RegisterSessionStatus,
} from '../models/register-session.schema';
import { UserModelConstants } from '../models/user.schema';
import { OpenRegisterDto } from './dto/open-register.dto';
import { CloseRegisterDto } from './dto/close-register.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';

@Injectable()
export class RegisterService extends GenericDatabase<
  Model<RegisterSessionDocument>
> {
  constructor(
    @InjectModel(RegisterSessionSchemaName)
    private readonly registerModel: Model<RegisterSessionDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {
    super(registerModel);
  }

  async openRegister(
    dto: OpenRegisterDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const activeSession = await this.genericFindOne({
        companyId: new Types.ObjectId(dto.companyId),
        userId: new Types.ObjectId(userId),
        status: RegisterSessionStatus.OPEN,
      });

      if (activeSession) {
        throw new BadRequestException(
          'You already have an active register session open',
        );
      }

      const created = await this.genericCreateOne({
        ...dto,
        userId: new Types.ObjectId(userId),
        companyId: new Types.ObjectId(dto.companyId),
        openingCash: dto.openingCash ?? 0,
        status: RegisterSessionStatus.OPEN,
        openedAt: new Date(),
        notes: dto.notes?.trim(),
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.OPEN_REGISTER,
        entityType: LogEntityType.REGISTER_SESSION,
        entityId: new Types.ObjectId(created._id),
        description: `Register opened with cash: ${dto.openingCash}`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Register session opened successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.OPEN_REGISTER,
        entityType: LogEntityType.REGISTER_SESSION,
        entityId: new Types.ObjectId(),
        description: `Failed to open register session`,
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
      throw new BadRequestException('Error opening register session');
    }
  }

  async getCurrentSession(userId: string, companyId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const session = await this.registerModel
        .findOne({
          companyId: new Types.ObjectId(companyId),
          userId: new Types.ObjectId(userId),
          status: RegisterSessionStatus.OPEN,
          isDeleted: false,
        })
        .populate([
          {
            path: RegisterSessionModelConstants.userId,
            select: `${UserModelConstants.username} ${UserModelConstants.name}`,
          },
        ]);

      return {
        success: true,
        message: session
          ? 'Active register session found'
          : 'No active register session',
        data: session || null,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching current register session');
    }
  }

  async closeRegister(
    id: string,
    dto: CloseRegisterDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const session = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
        status: RegisterSessionStatus.OPEN,
      });

      if (!session) {
        throw new NotFoundException('Active register session not found');
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        closingCash: dto.closingCash,
        status: RegisterSessionStatus.CLOSED,
        closedAt: new Date(),
        notes: dto.notes?.trim()
          ? `${session.notes || ''} | Closing notes: ${dto.notes.trim()}`
          : session.notes,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CLOSE_REGISTER,
        entityType: LogEntityType.REGISTER_SESSION,
        entityId: new Types.ObjectId(id),
        description: `Register closed with cash: ${dto.closingCash}`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Register session closed successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CLOSE_REGISTER,
        entityType: LogEntityType.REGISTER_SESSION,
        entityId: new Types.ObjectId(id),
        description: `Failed to close register session`,
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
      throw new BadRequestException('Error closing register session');
    }
  }
}
