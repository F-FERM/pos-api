import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CompanyService } from '../company/company.service';
import {
  NumberSettingDocument,
  NumberSettingSchemaName,
} from '../models/number-settings.schema';
import { UserService } from '../user/user.service';
import { numberSettingsDocumentType } from '../utils/common.enum';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  DEFAULT_NUMBER_SETTINGS,
  DEFAULT_PREFIX_MAP,
} from '../common/seeds/number-settings.data';

@Injectable()
export class NumberSettingsService extends GenericDatabase<
  Model<NumberSettingDocument>
> {
  constructor(
    @InjectModel(NumberSettingSchemaName)
    private readonly model: Model<NumberSettingDocument>,
    private readonly userService: UserService,
    private readonly companyService: CompanyService,
  ) {
    super(model);
  }

  async createDefaultSetting(
    companyId: string,
    userId: string,
    docType: numberSettingsDocumentType,
    config: {
      prefix: string;
      nextNumber: number;
    },
    session?: mongoose.ClientSession,
  ): Promise<NumberSettingDocument> {
    try {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        throw new BadRequestException('Invalid company ID');
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      const paddedNumber = config.nextNumber.toString().padStart(5, '0');

      const settingData = {
        companyId: new mongoose.Types.ObjectId(companyId),
        docType,
        prefix: config.prefix,
        nextNumber: config.nextNumber,
        nextNumberRaw: paddedNumber,
        isDeleted: false,
        createdBy: new mongoose.Types.ObjectId(userId),
      };

      const existing = await this.model.findOne({
        companyId: new mongoose.Types.ObjectId(companyId),
        docType,
        isDeleted: false,
      });

      if (existing) {
        const updateData = {
          prefix: config.prefix,
          nextNumber: config.nextNumber,
          nextNumberRaw: paddedNumber,
        };

        const updated = await this.model.findOneAndUpdate(
          {
            companyId: new mongoose.Types.ObjectId(companyId),
            docType,
          },
          { $set: updateData },
          { new: true, session },
        );

        if (!updated) {
          throw new BadRequestException('Failed to update number setting');
        }
        return updated;
      }

      if (session) {
        const [setting] = await this.model.create([settingData], { session });
        return setting;
      } else {
        return await this.model.create(settingData);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Failed to create default number setting');
    }
  }

  async createDefaultSettingsForCompany(
    companyId: string,
    userId: string,
    session?: mongoose.ClientSession,
  ): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(companyId)) {
        throw new BadRequestException('Invalid company ID');
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID');
      }

      for (const config of DEFAULT_NUMBER_SETTINGS) {
        try {
          await this.createDefaultSetting(
            companyId,
            userId,
            config.docType,
            {
              prefix: config.prefix,
              nextNumber: config.nextNumber,
            },
            session,
          );
        } catch (error) {
          console.log(`Failed to create setting for ${config.docType}:`, error);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException(
        'Failed to create default number settings for company',
      );
    }
  }

  async upsertSetting(
    companyId: string,
    userId: string,
    docType: numberSettingsDocumentType,
    data?: {
      prefix?: string;
      nextNumber?: number;
    },
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const setData: any = {};
      const setOnInsert: any = {
        companyId: new mongoose.Types.ObjectId(companyId),
        docType,
      };

      if (data?.nextNumber !== undefined && data?.nextNumber !== null) {
        const numeric = Number(data.nextNumber);
        if (isNaN(numeric) || numeric < 1) {
          throw new BadRequestException('Next number must be a number >= 1');
        }

        const padded = numeric.toString().padStart(5, '0');
        setData.nextNumber = numeric;
        setData.nextNumberRaw = padded;
      }

      if (data?.prefix !== undefined) {
        const cleanPrefix =
          data.prefix.trim().toUpperCase() || this.getPrefix(docType);
        setData.prefix = cleanPrefix;
      }

      if (data?.prefix === undefined) {
        setOnInsert.prefix = this.getPrefix(docType);
      }

      if (data?.nextNumber === undefined) {
        setOnInsert.nextNumber = 1;
        setOnInsert.nextNumberRaw = '00001';
      }

      const result = await this.model.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          docType,
        },
        {
          ...(Object.keys(setData).length && { $set: setData }),
          $setOnInsert: setOnInsert,
        },
        {
          new: true,
          upsert: true,
        },
      );

      if (!result) {
        throw new BadRequestException('Failed to save number setting');
      }

      return {
        success: true,
        message: 'Number setting saved successfully',
        data: result,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Failed to upsert number setting');
    }
  }

  async generateNumber(
    companyId: string,
    userId: string,
    docType: numberSettingsDocumentType,
    session?: mongoose.ClientSession,
  ): Promise<string> {
    await this.userService.validateAuthenticatedUser(userId);
    await this.companyService.validateCompany(companyId, userId);

    let setting: NumberSettingDocument | null = await this.model.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      docType,
      isDeleted: false,
    });

    if (!setting) {
      setting = await this.createDefaultSetting(
        companyId,
        userId,
        docType,
        {
          prefix: this.getPrefix(docType),
          nextNumber: 1,
        },
        session,
      );
    }

    const updated: NumberSettingDocument | null =
      await this.model.findOneAndUpdate(
        {
          companyId: new mongoose.Types.ObjectId(companyId),
          docType,
        },
        { $inc: { nextNumber: 1 } },
        { new: true, session },
      );

    if (!updated) {
      throw new BadRequestException('Failed to generate document number');
    }

    const currentNumber = updated.nextNumber - 1;
    const paddedNumber = currentNumber.toString().padStart(5, '0');
    const formattedNumber = `${updated.prefix}${paddedNumber}`;

    await this.model.updateOne(
      { _id: updated._id },
      {
        $set: { nextNumberRaw: updated.nextNumber.toString().padStart(5, '0') },
      },
      { session },
    );

    return formattedNumber;
  }

  async getOne(
    companyId: string,
    userId: string,
    docType: numberSettingsDocumentType,
  ) {
    await this.userService.validateAuthenticatedUser(userId);
    await this.companyService.validateCompany(companyId, userId);
    const data = await this.model.findOne({
      companyId: new mongoose.Types.ObjectId(companyId),
      docType,
      isDeleted: false,
    });

    if (!data) {
      throw new BadRequestException(
        'Number setting is not configured. Please configure it first.',
      );
    }

    return {
      success: true,
      message: 'Fetched successfully',
      data,
    };
  }

  private getPrefix(docType: numberSettingsDocumentType): string {
    return DEFAULT_PREFIX_MAP[docType] || 'DOC-';
  }

  async getAllSettings(
    companyId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: NumberSettingDocument[];
    count: number;
  }> {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const settings = await this.model
        .find({
          companyId: new mongoose.Types.ObjectId(companyId),
          isDeleted: false,
        })
        .sort({ docType: 1 });

      return {
        success: true,
        message: 'Number settings retrieved successfully',
        data: settings || [],
        count: settings?.length || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Failed to fetch number settings');
    }
  }

  async getById(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    message: string;
    data: NumberSettingDocument;
  }> {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid number setting ID');
      }

      const setting = await this.model.findOne({
        _id: new mongoose.Types.ObjectId(id),
        companyId: new mongoose.Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!setting) {
        throw new NotFoundException('Number setting not found');
      }

      return {
        success: true,
        message: 'Number setting retrieved successfully',
        data: setting,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Failed to fetch number setting by ID');
    }
  }
}
