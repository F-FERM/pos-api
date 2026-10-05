import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  LogsModel,
  LogsModelDocument,
  LogsModelSchemaName,
} from '../models/logs.schema';
import { LogStatus } from '../utils/common.enum';

@Injectable()
export class LogService extends GenericDatabase<Model<LogsModelDocument>> {
  constructor(
    @InjectModel(LogsModelSchemaName)
    private logsModel: Model<LogsModelDocument>,
  ) {
    super(logsModel);
  }

  async createLog({
    companyId,
    action,
    entityType,
    entityId,
    description,
    path,
    additionalData,
    createdBy,
    ipAddress,
    status,
  }: {
    companyId: Types.ObjectId | null;
    action: string;
    entityType: string;
    entityId: Types.ObjectId;
    description: string;
    path: string;
    additionalData?: any;
    createdBy: Types.ObjectId;
    ipAddress: string;
    status: LogStatus;
  }) {
    try {
      const logsModelData: LogsModel = {
        companyId,
        action,
        entityType,
        entityId,
        description,
        path,
        additionalData,
        createdBy,
        date: new Date(),
        isDeleted: false,
        ipAddress,
        status,
      };

      await this.genericCreateOne(logsModelData);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while creating logs', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Unknow Error : Failed to create logs', error);
      throw new ConflictException('Failed to Create Logs');
    }
  }
}
