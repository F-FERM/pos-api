import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession, Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  LoyaltySettingDocument,
  LoyaltySettingSchemaName,
} from '../models/loyalty-setting.schema';
import { UpdateLoyaltySettingDto } from './dto/update-loyalty-setting.dto';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { LogService } from '../log/log.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { DEFAULT_LOYALTY_SETTINGS } from '../common/seeds/loyalty-settings.data';

@Injectable()
export class LoyaltySettingService extends GenericDatabase<
  Model<LoyaltySettingDocument>
> {
  constructor(
    @InjectModel(LoyaltySettingSchemaName)
    private readonly loyaltyModel: Model<LoyaltySettingDocument>,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly logService: LogService,
  ) {
    super(loyaltyModel);
  }

  async createDefaultSettingForCompany(
    companyId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<LoyaltySettingDocument> {
    const existing = await this.loyaltyModel.findOne({
      companyId: new Types.ObjectId(companyId),
      isDeleted: false,
    });

    if (existing) return existing;

    const settingData = {
      ...DEFAULT_LOYALTY_SETTINGS,
      companyId: new Types.ObjectId(companyId),
      createdBy: new Types.ObjectId(userId),
      isDeleted: false,
    };

    if (session) {
      const [created] = await this.loyaltyModel.create([settingData], {
        session,
      });
      return created;
    }

    return await this.loyaltyModel.create(settingData);
  }

  async getSetting(companyId: string, userId?: string) {
    try {
      if (userId) {
        await this.userService.validateAuthenticatedUser(userId);
      }
      if (companyId) {
        await this.companyService.validateCompany(companyId, userId);
      }

      let setting: any = await this.loyaltyModel.findOne({
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!setting && userId) {
        setting = await this.createDefaultSettingForCompany(companyId, userId);
      }

      return {
        success: true,
        message: 'Loyalty settings fetched successfully',
        data: setting,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching loyalty settings');
    }
  }

  async upsertSetting(
    dto: UpdateLoyaltySettingDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const updated = await this.loyaltyModel.findOneAndUpdate(
        { companyId: new Types.ObjectId(dto.companyId) },
        {
          $set: {
            ...(dto.loyaltyAmountPerPoint !== undefined && {
              loyaltyAmountPerPoint: dto.loyaltyAmountPerPoint,
            }),
            ...(dto.minLoyaltyPointsToRedeem !== undefined && {
              minLoyaltyPointsToRedeem: dto.minLoyaltyPointsToRedeem,
            }),
            ...(dto.loyaltyPointMonetaryValue !== undefined && {
              loyaltyPointMonetaryValue: dto.loyaltyPointMonetaryValue,
            }),
            ...(dto.isEnabled !== undefined && {
              isEnabled: dto.isEnabled,
            }),
            isDeleted: false,
          },
          $setOnInsert: {
            companyId: new Types.ObjectId(dto.companyId),
            createdBy: new Types.ObjectId(userId),
          },
        },
        { new: true, upsert: true },
      );

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_LOYALTY_SETTING,
        entityType: LogEntityType.LOYALTY_SETTING,
        entityId: new Types.ObjectId(updated._id),
        description: `Updated loyalty program settings`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Loyalty settings updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_LOYALTY_SETTING,
        entityType: LogEntityType.LOYALTY_SETTING,
        entityId: new Types.ObjectId(),
        description: 'Failed to update loyalty settings',
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
      throw new BadRequestException('Error updating loyalty settings');
    }
  }
}
