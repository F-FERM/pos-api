import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  DeviceRegistration,
  DeviceRegistrationDocument,
  DeviceRegistrationModelConstants,
  DeviceRegistrationSchemaName,
  DeviceStatus,
} from '../models/device-registration.schema';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import { CounterModelConstants } from '../models/counter.schema';
import { UserModelConstants } from '../models/user.schema';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { VerifyDeviceDto } from './dto/verify-device.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class DeviceRegistrationService extends GenericDatabase<
  Model<DeviceRegistrationDocument>
> {
  constructor(
    @InjectModel(DeviceRegistrationSchemaName)
    private readonly deviceModel: Model<DeviceRegistrationDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly jwtService: JwtService,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {
    super(deviceModel);
  }

  async verifyDevice(dto: VerifyDeviceDto, req: AuthedRequest) {
    try {
      const ipAddress = await this.getClientIpAddress(req);

      const filter: Record<string, unknown> = {
        deviceId: dto.deviceId.trim(),
        isDeleted: false,
      };

      if (dto.licenseKey) {
        filter.licenseKey = dto.licenseKey.trim().toUpperCase();
      }

      const device = await this.deviceModel
        .findOne(filter)
        .populate([
          {
            path: DeviceRegistrationModelConstants.counterId,
            select: `${CounterModelConstants.name} ${CounterModelConstants.code}`,
          },
        ]);

      if (!device || device.status !== DeviceStatus.ACTIVE) {
        return {
          success: true,
          message: 'Device registration required or inactive',
          data: {
            isRegistered: false,
            requiresActivation: true,
            isBypassedInhouse: false,
          },
          statusCode: HttpStatus.OK,
        };
      }

      const company = await this.companyModel.findOne({
        _id: device.companyId,
        isDeleted: false,
      });

      if (!company) {
        throw new BadRequestException('Associated company store not found');
      }

      await this.deviceModel.updateOne(
        { _id: device._id },
        {
          $set: {
            ipAddress,
            lastPingAt: new Date(),
          },
        },
      );

      await this.logService.createLog({
        companyId: device.companyId,
        createdBy: device.createdBy,
        action: LogActions.VERIFY_DEVICE,
        entityType: LogEntityType.DEVICE_REGISTRATION,
        entityId: new Types.ObjectId(device._id),
        description: `Device ${device.deviceName} (${device.deviceId}) verified - Inhouse Auto-Bypass Active`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Device verified successfully - Direct login enabled',
        data: {
          isRegistered: true,
          requiresActivation: false,
          isBypassedInhouse: device.isBypassedInhouse,
          deviceToken: device.deviceToken,
          device: {
            id: device._id,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            counter: device.counterId,
          },
          company: {
            id: company._id,
            name: company.name,
            code: company.code,
            slug: company.slug,
          },
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error verifying device registration');
    }
  }

  async registerDevice(dto: RegisterDeviceDto, req: AuthedRequest) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      const cleanLicenseKey = dto.licenseKey.trim().toUpperCase();

      const company = await this.companyModel.findOne({
        $or: [
          { code: cleanLicenseKey },
          { 'subscription.planCode': cleanLicenseKey },
          { slug: cleanLicenseKey.toLowerCase() },
        ],
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException(
          'Invalid store license key or company code',
        );
      }

      const activeDevicesCount = await this.deviceModel.countDocuments({
        companyId: company._id,
        status: DeviceStatus.ACTIVE,
        isDeleted: false,
      });

      const maxAllowedTerminals = company.subscription?.maxTerminals || 5;

      if (activeDevicesCount >= maxAllowedTerminals) {
        throw new BadRequestException(
          `Terminal registration limit reached for this store license (${activeDevicesCount}/${maxAllowedTerminals} active terminals). Upgrade subscription to add more counter PCs.`,
        );
      }

      const existingDevice = await this.deviceModel.findOne({
        companyId: company._id,
        deviceId: dto.deviceId.trim(),
        isDeleted: false,
      });

      if (existingDevice) {
        if (existingDevice.status === DeviceStatus.REVOKED) {
          throw new UnauthorizedException(
            'This terminal device registration was revoked by store management',
          );
        }

        await this.deviceModel.updateOne(
          { _id: existingDevice._id },
          {
            $set: {
              status: DeviceStatus.ACTIVE,
              deviceName: dto.deviceName.trim(),
              ipAddress,
              lastPingAt: new Date(),
              ...(dto.counterId && {
                counterId: new Types.ObjectId(dto.counterId),
              }),
            },
          },
        );

        return {
          success: true,
          message: 'Device re-activated and registered successfully',
          data: {
            deviceToken: existingDevice.deviceToken,
            company: {
              id: company._id,
              name: company.name,
              code: company.code,
            },
          },
          statusCode: HttpStatus.OK,
        };
      }

      const devicePayload = {
        companyId: company._id.toString(),
        deviceId: dto.deviceId.trim(),
        licenseKey: cleanLicenseKey,
      };

      const deviceToken = this.jwtService.sign(devicePayload);

      const createdDevice = await this.genericCreateOne({
        deviceId: dto.deviceId.trim(),
        deviceName: dto.deviceName.trim(),
        licenseKey: cleanLicenseKey,
        deviceToken,
        status: DeviceStatus.ACTIVE,
        isBypassedInhouse: true,
        companyId: company._id,
        counterId: dto.counterId ? new Types.ObjectId(dto.counterId) : null,
        ipAddress,
        lastPingAt: new Date(),
        createdBy: company.ownerId,
      });

      await this.logService.createLog({
        companyId: company._id,
        createdBy: company.ownerId,
        action: LogActions.REGISTER_DEVICE,
        entityType: LogEntityType.DEVICE_REGISTRATION,
        entityId: new Types.ObjectId(createdDevice._id),
        description: `Terminal PC '${createdDevice.deviceName}' registered for store '${company.name}'`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Terminal PC registered and licensed successfully',
        data: {
          deviceToken,
          device: {
            id: createdDevice._id,
            deviceId: createdDevice.deviceId,
            deviceName: createdDevice.deviceName,
          },
          company: {
            id: company._id,
            name: company.name,
            code: company.code,
          },
        },
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error registering device terminal');
    }
  }

  async findAllDevices(
    companyId: string,
    userId: string,
    roles: string[],
    page: number,
    limit: number,
    req: AuthedRequest,
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
          { deviceName: { $regex: search, $options: 'i' } },
          { deviceId: { $regex: search, $options: 'i' } },
          { licenseKey: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.deviceModel
          .find(filter)
          .populate([
            {
              path: DeviceRegistrationModelConstants.counterId,
              select: `${CounterModelConstants.name} ${CounterModelConstants.code}`,
            },
            {
              path: DeviceRegistrationModelConstants.createdBy,
              select: `${UserModelConstants.username} ${UserModelConstants.name}`,
            },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.deviceModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Registered terminal PCs fetched successfully',
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
      throw new BadRequestException('Error fetching registered terminals');
    }
  }

  async toggleBypassInhouse(
    id: string,
    isBypassedInhouse: boolean,
    companyId: string,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const device = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!device) {
        throw new NotFoundException('Registered device terminal not found');
      }

      const updated = await this.genericUpdateOne(id, {
        isBypassedInhouse,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.BYPASS_DEVICE,
        entityType: LogEntityType.DEVICE_REGISTRATION,
        entityId: new Types.ObjectId(id),
        description: `Terminal '${device.deviceName}' inhouse bypass set to ${isBypassedInhouse}`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Terminal inhouse auto-bypass status updated',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating terminal bypass mode');
    }
  }

  async revokeDevice(
    id: string,
    companyId: string,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const device = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!device) {
        throw new NotFoundException('Registered device terminal not found');
      }

      const updated = await this.genericUpdateOne(id, {
        status: DeviceStatus.REVOKED,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.REVOKE_DEVICE,
        entityType: LogEntityType.DEVICE_REGISTRATION,
        entityId: new Types.ObjectId(id),
        description: `Terminal PC '${device.deviceName}' license revoked`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Terminal device registration revoked successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error revoking terminal registration');
    }
  }
}
