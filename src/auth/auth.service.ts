import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { LogService } from '../log/log.service';
import { EmailService } from '../email/email.service';
import { AuthedRequest, IPermission } from '../utils/common.types';
import {
  UserDocument,
  UserModelConstants,
  UserSchemaName,
} from '../models/user.schema';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import { ModuleDocument, ModuleSchemaName } from '../models/module.schema';
import {
  SubModuleDocument,
  SubModuleSchemaName,
} from '../models/sub-module.schema';
import {
  EmailOtpDocument,
  EmailOtpSchemaName,
} from '../models/email-otp.schema';
import {
  PrivilegesDocument,
  PrivilegesSchemaName,
} from '../models/privilege.schema';
import {
  LicenseStatus,
  StoreLicenseDocument,
  StoreLicenseSchemaName,
} from '../models/store-license.schema';
import { RegisterStoreRequestDto } from './dto/register-store-request.dto';
import { VerifyOtpRequestDto } from './dto/verify-otp-request.dto';
import { ResendLicenseKeyRequestDto } from './dto/resend-license-key-request.dto';
import { NumberSettingsService } from '../number-settings/number-settings.service';
import { CounterService } from '../counter/counter.service';
import { LoyaltySettingService } from '../loyalty-setting/loyalty-setting.service';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';
import {
  CompanyBusinessType,
  CompanyIndustry,
  CompanySubscriptionStatus,
  TimeFormat,
} from '../utils/enums/company.enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    @InjectModel(UserSchemaName)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(ModuleSchemaName)
    private readonly moduleModel: Model<ModuleDocument>,
    @InjectModel(SubModuleSchemaName)
    private readonly subModuleModel: Model<SubModuleDocument>,
    @InjectModel(EmailOtpSchemaName)
    private readonly emailOtpModel: Model<EmailOtpDocument>,
    @InjectModel(PrivilegesSchemaName)
    private readonly privilegeModel: Model<PrivilegesDocument>,
    @InjectModel(StoreLicenseSchemaName)
    private readonly storeLicenseModel: Model<StoreLicenseDocument>,
    private readonly logService: LogService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly numberSettingsService: NumberSettingsService,
    private readonly counterService: CounterService,
    private readonly loyaltySettingService: LoyaltySettingService,
  ) {}

  async validateUser(username: string, pass: string) {
    const user = await this.userService.validateUser(username, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async requestStoreRegistration(dto: RegisterStoreRequestDto) {
    try {
      const email = dto.ownerEmail.trim().toLowerCase();

      const existingUser = await this.userModel.findOne({
        $or: [
          { username: dto.username.trim() },
          { phone: dto.ownerPhone.trim() },
          { email },
        ],
        isDeleted: false,
      });

      if (existingUser) {
        throw new BadRequestException(
          'A user or store with this username, phone number, or email already exists',
        );
      }

      // Generate 6-digit OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await this.emailOtpModel.deleteMany({ email });

      await this.emailOtpModel.create({
        email,
        otp,
        expiresAt,
        isVerified: false,
        registrationPayload: dto,
      });

      // Send verification OTP via Brevo SMTP
      await this.emailService.sendVerificationOtp(
        email,
        dto.ownerName.trim(),
        otp,
      );

      return {
        success: true,
        message: `Verification OTP code sent to ${email}`,
        data: {
          email,
          expiresInMinutes: 10,
          devOtpCode: otp, // Included for easy dev testing
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Failed to send registration OTP');
    }
  }

  async verifyStoreOtp(dto: VerifyOtpRequestDto) {
    try {
      const email = dto.email.trim().toLowerCase();
      const otpRecord = await this.emailOtpModel.findOne({
        email,
        otp: dto.otp.trim(),
        isVerified: false,
      });

      if (!otpRecord) {
        throw new BadRequestException('Invalid or expired OTP code');
      }

      if (new Date() > otpRecord.expiresAt) {
        throw new BadRequestException(
          'OTP code has expired. Please request a new OTP.',
        );
      }

      const storeDto: RegisterStoreRequestDto =
        otpRecord.registrationPayload as RegisterStoreRequestDto;

      if (!storeDto || !storeDto.companyName) {
        throw new BadRequestException('Invalid registration payload');
      }

      const cleanCode =
        storeDto.companyName
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 6)
          .toUpperCase() + Math.floor(100 + Math.random() * 900);

      const cleanSlug = storeDto.companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let existingLicense = await this.storeLicenseModel.findOne({
        assignedEmail: email,
        status: { $in: [LicenseStatus.ASSIGNED, LicenseStatus.UNASSIGNED] },
        isDeleted: false,
      });

      if (!existingLicense) {
        existingLicense = await this.storeLicenseModel.findOne({
          status: LicenseStatus.UNASSIGNED,
          isDeleted: false,
        });
      }

      const licenseKey = existingLicense
        ? existingLicense.licenseKey
        : `LIC-${cleanCode}-${Math.floor(10000 + Math.random() * 90000)}`;

      const hashedPassword = await bcrypt.hash(storeDto.password, 10);

      let ownerPrivilege = await this.privilegeModel.findOne({
        name: 'Store Admin',
        isDeleted: false,
      });

      if (!ownerPrivilege) {
        ownerPrivilege = await this.privilegeModel.create({
          name: 'Store Admin',
          description: 'Default Store Owner Privilege',
          roles: [Role.admin],
          isSystemGenerated: true,
        });
      }

      const [createdOwner] = await this.userModel.create([
        {
          username: (storeDto.username || storeDto.ownerPhone).trim(),
          phone: storeDto.ownerPhone.trim(),
          name: storeDto.ownerName.trim(),
          email,
          password: hashedPassword,
          privilegeId: ownerPrivilege._id,
          isActive: true,
        },
      ]);

      const maxCounters = existingLicense ? existingLicense.maxCounters : 5;
      const maxUsers = existingLicense ? existingLicense.maxUsers : 10;

      const createdCompany = await this.companyModel.create({
        name: storeDto.companyName.trim(),
        code: cleanCode,
        slug: `${cleanSlug}-${Date.now().toString().slice(-4)}`,
        licenseKey,
        industry: CompanyIndustry.GENERAL_RETAIL,
        businessType: CompanyBusinessType.RETAIL,
        ownerId: createdOwner._id,
        createdBy: createdOwner._id,
        contact: {
          primaryEmail: email,
          primaryPhone: storeDto.ownerPhone.trim(),
        },
        address: {
          line1: 'Store Address Line 1',
          city: storeDto.city.trim(),
          state: storeDto.state.trim(),
          postalCode: storeDto.postalCode?.trim() || '000000',
          country: storeDto.country || 'IN',
        },
        regional: {
          currency: 'INR',
          currencySymbol: '₹',
          timezone: 'Asia/Kolkata',
          locale: 'en-IN',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: TimeFormat.TWELVE_HOUR,
          fiscalYearStartMonth: 4,
        },
        maxCounters,
        maxUsers,
        subscription: {
          status: CompanySubscriptionStatus.ACTIVE,
          maxUsers,
          maxCounters,
        },
      });

      if (existingLicense) {
        await this.storeLicenseModel.updateOne(
          { _id: existingLicense._id },
          {
            $set: {
              companyId: createdCompany._id,
              assignedEmail: email,
              status: LicenseStatus.REDEEMED,
              redeemedAt: new Date(),
            },
          },
        );
      } else {
        await this.storeLicenseModel.create({
          licenseKey,
          assignedEmail: email,
          companyId: createdCompany._id,
          status: LicenseStatus.REDEEMED,
          maxCounters: 5,
          maxUsers: 10,
          validityMonths: 12,
          redeemedAt: new Date(),
          createdBy: createdOwner._id,
        });
      }

      await this.userModel.updateOne(
        { _id: createdOwner._id },
        { $set: { companyId: createdCompany._id } },
      );

      // Auto-seed default Number Settings, Counter, and Loyalty Settings for new company
      try {
        await this.numberSettingsService.createDefaultSettingsForCompany(
          createdCompany._id.toString(),
          createdOwner._id.toString(),
        );
        await this.counterService.createDefaultCounterForCompany(
          createdCompany._id.toString(),
          createdOwner._id.toString(),
        );
        await this.loyaltySettingService.createDefaultSettingForCompany(
          createdCompany._id.toString(),
          createdOwner._id.toString(),
        );
      } catch (seedErr) {
        console.warn(
          'Failed to auto-seed defaults for registered store:',
          seedErr,
        );
      }

      await this.emailOtpModel.updateOne(
        { _id: otpRecord._id },
        { $set: { isVerified: true } },
      );

      // Send Store License Key email via Brevo SMTP
      await this.emailService.sendLicenseIssuedEmail(
        email,
        storeDto.ownerName.trim(),
        createdCompany.name,
        licenseKey,
        maxCounters,
      );

      return {
        success: true,
        message:
          'Store registration verified and License Key generated successfully! Check your email for activation details.',
        data: {
          licenseKey,
          company: {
            id: createdCompany._id,
            name: createdCompany.name,
            code: createdCompany.code,
            licenseKey,
          },
          owner: {
            id: createdOwner._id,
            username: createdOwner.username,
            name: createdOwner.name,
            email: createdOwner.email,
          },
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException(
        'Error verifying OTP and registering store',
      );
    }
  }

  async resendLicenseKey(dto: ResendLicenseKeyRequestDto) {
    try {
      const email = dto.email.trim().toLowerCase();

      const company = await this.companyModel.findOne({
        $or: [
          { 'contact.primaryEmail': email },
          { 'contact.secondaryEmail': email },
        ],
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException(
          'No store found registered with this email address',
        );
      }

      let licenseKey = company.licenseKey;

      if (!licenseKey) {
        licenseKey = `LIC-${company.code}-${Math.floor(10000 + Math.random() * 90000)}`;
        await this.companyModel.updateOne(
          { _id: company._id },
          { $set: { licenseKey } },
        );
      }

      const owner = await this.userModel.findOne({
        _id: company.ownerId,
        isDeleted: false,
      });

      const maxCounters =
        company.maxCounters || company.subscription?.maxCounters || 5;

      await this.emailService.sendLicenseIssuedEmail(
        email,
        owner?.name || company.name,
        company.name,
        licenseKey,
        maxCounters,
      );

      return {
        success: true,
        message: `Store License Key sent successfully to ${email}`,
        data: {
          email,
          companyName: company.name,
        },
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error sending store license key');
    }
  }

  async login(user: any, req?: AuthedRequest) {
    try {
      const _user = (await this.userService.genericFindOneWithPopulate(
        { _id: user._id },
        [
          {
            path: UserModelConstants.privilegeId,
            select: 'roles modules subModulePermissions',
          },
        ],
      )) as UserDocument;

      const ipAddress = req
        ? await this.userService.getClientIpAddress(req)
        : 'SYSTEM';

      if (!_user?.privilegeId) {
        throw new BadRequestException('Privilege not found');
      }

      const privilege: any = _user.privilegeId;

      const roles = Array.isArray(privilege.roles)
        ? privilege.roles
        : [privilege.roles];

      const payload: any = {
        username: _user.username,
        userId: _user._id,
        companyId: _user.companyId ? _user.companyId.toString() : '',
        email: _user.email || '',
        roles,
      };

      if (roles.includes(Role.superadmin)) {
        await this.logService.createLog({
          companyId: _user?.companyId ?? null,
          action: LogActions.USER_LOGIN,
          entityType: LogEntityType.AUTH,
          entityId: new Types.ObjectId(_user._id),
          description: 'Superadmin login successful',
          path: req ? req.url : '/auth/login',
          additionalData: {
            email: _user.email,
            roles,
          },
          createdBy: new Types.ObjectId(_user._id),
          ipAddress,
          status: LogStatus.SUCCESS,
        });

        return {
          access_token: this.jwtService.sign(payload),
          expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        };
      }

      const privilegeModuleIds = (privilege.modules || [])
        .map((m: any) => m?.toString())
        .filter(Boolean);

      let modules: any[] = [];

      if (privilegeModuleIds.length > 0) {
        modules = await this.moduleModel.find({
          _id: { $in: privilegeModuleIds },
          isDeleted: false,
        });
      }

      payload.modules = modules.map((m: any) => m.identity);

      const subModulePermissions = Array.isArray(privilege.subModulePermissions)
        ? privilege.subModulePermissions
        : [];

      const subModuleIds = subModulePermissions
        .map((p: any) => p?.subModuleId?.toString())
        .filter(Boolean);

      let subModules: any[] = [];

      if (subModuleIds.length > 0) {
        subModules = await this.subModuleModel.find({
          _id: { $in: subModuleIds },
          isDeleted: false,
        });
      }

      const subModuleMap: Record<string, string> = {};

      subModules.forEach((sm: any) => {
        subModuleMap[sm._id.toString()] = sm.identity;
      });

      const permissions: IPermission[] = subModulePermissions.map((p: any) => ({
        subModule: subModuleMap[p.subModuleId?.toString()] || '',
        subModuleId: p.subModuleId?.toString(),
        canCreate: !!p.canCreate,
        canRead: !!p.canRead,
        canUpdate: !!p.canUpdate,
        canDelete: !!p.canDelete,
      }));

      payload.permissions = permissions;

      await this.userService.genericUpdateOne(_user._id.toString(), {
        $set: {
          lastLoginAt: new Date(),
        },
      });

      await this.logService.createLog({
        companyId: _user?.companyId ?? null,
        action: LogActions.USER_LOGIN,
        entityType: LogEntityType.AUTH,
        entityId: new Types.ObjectId(_user._id),
        description: 'User login successful',
        path: req ? req.url : '/auth/login',
        additionalData: {
          email: _user.email,
          roles,
        },
        createdBy: new Types.ObjectId(_user._id),
        ipAddress,
        status: LogStatus.SUCCESS,
      });

      return {
        access_token: this.jwtService.sign(payload),
        expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      };
    } catch (error: unknown) {
      const ipAddress: string = await this.userService.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: user?.companyId ?? null,
        action: LogActions.USER_LOGIN,
        entityType: LogEntityType.AUTH,
        entityId: user?._id
          ? new Types.ObjectId(user._id)
          : new Types.ObjectId(),
        description: 'Login failed',
        path: req ? req.url : '/auth/login',
        additionalData: {
          error: error instanceof Error ? error.message : error,
          attemptedUserId: user?._id,
        },
        createdBy: user?._id
          ? new Types.ObjectId(user._id)
          : new Types.ObjectId(),
        ipAddress,
        status: LogStatus.FAILED,
      });

      if (error instanceof Error) {
        console.log('Error while login user', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while login user', error);
      throw new BadRequestException('Error while login user');
    }
  }
}
