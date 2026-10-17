import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GenericDatabase } from '../helper/genericDatabase';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import { ProductDocument, ProductSchemaName } from '../models/product.schema';
import { UpdateWeighScaleSettingsDto } from './dto/update-scale-settings.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus, ScaleBarcodeType } from '../utils/common.enum';

import { ScaleProtocolParser } from './utils/scale-protocol-parser';

@Injectable()
export class WeighScaleService {
  constructor(
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(ProductSchemaName)
    private readonly productModel: Model<ProductDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
  ) {}

  async getScaleSettings(companyId: string, userId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const company = await this.companyModel.findOne({
        _id: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException('Company store not found');
      }

      const defaultSettings = {
        enabled: company.features?.weightedItemsEnabled ?? false,
        barcodePrefix: '21',
        barcodeType: ScaleBarcodeType.WEIGHT_EMBEDDED,
        pluLength: 5,
        weightMultiplier: 0.001,
        directScaleProtocol: 'CAS',
        baudRate: 9600,
      };

      const settings = company.weighScaleSettings
        ? { ...defaultSettings, ...company.weighScaleSettings }
        : defaultSettings;

      return {
        success: true,
        message: 'Weigh scale settings retrieved successfully',
        data: settings,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching weigh scale settings');
    }
  }

  async updateScaleSettings(
    dto: UpdateWeighScaleSettingsDto,
    companyId: string,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = req ? await this.userService.getClientIpAddress(req) : '';
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const company = await this.companyModel.findOne({
        _id: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException('Company store not found');
      }

      const currentSettings = company.weighScaleSettings || {
        enabled: false,
        barcodePrefix: '21',
        barcodeType: ScaleBarcodeType.WEIGHT_EMBEDDED,
        pluLength: 5,
        weightMultiplier: 0.001,
        directScaleProtocol: 'CAS',
        baudRate: 9600,
      };

      const updatedSettings = {
        enabled: dto.enabled !== undefined ? dto.enabled : currentSettings.enabled,
        barcodePrefix: dto.barcodePrefix
          ? dto.barcodePrefix.trim()
          : currentSettings.barcodePrefix,
        barcodeType: dto.barcodeType || currentSettings.barcodeType,
        pluLength: dto.pluLength || currentSettings.pluLength,
        weightMultiplier:
          dto.weightMultiplier !== undefined
            ? dto.weightMultiplier
            : currentSettings.weightMultiplier,
        directScaleProtocol: dto.directScaleProtocol
          ? dto.directScaleProtocol.trim()
          : currentSettings.directScaleProtocol,
        baudRate: dto.baudRate || currentSettings.baudRate,
      };

      await this.companyModel.updateOne(
        { _id: new Types.ObjectId(companyId) },
        {
          $set: {
            weighScaleSettings: updatedSettings,
            'features.weightedItemsEnabled': updatedSettings.enabled,
            isSynced: false,
          },
        },
      );

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(companyId),
        description: `Weigh scale settings updated (enabled: ${updatedSettings.enabled}, prefix: ${updatedSettings.barcodePrefix})`,
        ipAddress,
        path: req?.url || '/weigh-scale/settings',
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Weigh scale settings updated successfully',
        data: updatedSettings,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = req ? await this.userService.getClientIpAddress(req) : '';
      await this.logService.createLog({
        companyId: companyId ? new Types.ObjectId(companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_COMPANY,
        entityType: LogEntityType.COMPANY,
        entityId: new Types.ObjectId(companyId),
        description: 'Failed to update weigh scale settings',
        ipAddress,
        path: req?.url || '/weigh-scale/settings',
        status: LogStatus.FAILED,
        additionalData: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error updating weigh scale settings');
    }
  }

  async parseScaleBarcode(
    barcodeString: string,
    companyId: string,
    userId: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const company = await this.companyModel.findOne({
        _id: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException('Company store not found');
      }

      const settings = company.weighScaleSettings || {
        enabled: true,
        barcodePrefix: '21',
        barcodeType: ScaleBarcodeType.WEIGHT_EMBEDDED,
        pluLength: 5,
        weightMultiplier: 0.001,
      };

      const rawBarcode = barcodeString.trim();
      const prefix = settings.barcodePrefix || '21';
      const pluLength = settings.pluLength || 5;

      // Check if barcode is a scale-generated barcode (starts with prefix or EAN-13 variable weight 20-29)
      const isScalePrefix =
        rawBarcode.startsWith(prefix) ||
        (rawBarcode.length === 13 && /^2[0-9]/.test(rawBarcode));

      if (!isScalePrefix) {
        // Fallback to exact barcode match
        const exactProduct = await this.productModel.findOne({
          companyId: new Types.ObjectId(companyId),
          barcode: rawBarcode,
          isDeleted: false,
        });

        if (!exactProduct) {
          throw new NotFoundException(
            `Product with barcode '${rawBarcode}' not found`,
          );
        }

        return {
          success: true,
          message: 'Product retrieved by exact barcode',
          data: {
            isScaleBarcode: false,
            product: exactProduct,
            quantity: 1,
            unitPrice: exactProduct.sellingPrice,
            totalPrice: exactProduct.sellingPrice,
          },
          statusCode: HttpStatus.OK,
        };
      }

      // Extract PLU Code & Raw Value
      const prefixLen = prefix.length;
      const pluCode = rawBarcode.substring(prefixLen, prefixLen + pluLength);
      const valueDigits = rawBarcode.substring(prefixLen + pluLength, 12);
      const rawNum = parseFloat(valueDigits) || 0;

      // Find product by scalePlu, barcode, or SKU
      const product = await this.productModel.findOne({
        companyId: new Types.ObjectId(companyId),
        $or: [
          { scalePlu: pluCode },
          { scalePlu: pluCode.replace(/^0+/, '') },
          { barcode: pluCode },
          { barcode: rawBarcode },
          { sku: pluCode },
        ],
        isDeleted: false,
      });

      if (!product) {
        throw new NotFoundException(
          `Weighted product with scale PLU '${pluCode}' not found in store catalog`,
        );
      }

      let netQuantity = 1;
      let totalPrice = product.sellingPrice;
      const unitPrice = product.sellingPrice;

      if (settings.barcodeType === ScaleBarcodeType.PRICE_EMBEDDED) {
        totalPrice = Math.round((rawNum / 100) * 100) / 100;
        netQuantity =
          unitPrice > 0 ? Math.round((totalPrice / unitPrice) * 1000) / 1000 : 1;
      } else {
        // WEIGHT_EMBEDDED (Default)
        const grossWeight = rawNum * (settings.weightMultiplier || 0.001);
        const tare = product.tareWeight || 0;
        netQuantity = Math.max(0.001, grossWeight - tare);
        netQuantity = Math.round(netQuantity * 1000) / 1000;
        totalPrice = Math.round(netQuantity * unitPrice * 100) / 100;
      }

      return {
        success: true,
        message: 'Scale barcode parsed successfully',
        data: {
          isScaleBarcode: true,
          product: {
            id: product._id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            scalePlu: product.scalePlu,
            unitOfMeasure: product.scaleUnit || product.unitOfMeasure || 'KG',
            sellingPrice: product.sellingPrice,
            isWeighted: true,
          },
          pluCode,
          quantity: netQuantity,
          unitPrice,
          totalPrice,
          unitOfMeasure: product.scaleUnit || product.unitOfMeasure || 'KG',
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error parsing weigh scale barcode');
    }
  }

  async parseDirectWeight(
    rawData: string,
    companyId: string,
    userId: string,
    productId?: string,
    protocol?: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const company = await this.companyModel.findOne({
        _id: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException('Company store not found');
      }

      const activeProtocol =
        protocol || company.weighScaleSettings?.directScaleProtocol || 'CAS';

      const parsed = ScaleProtocolParser.parseRawScaleString(
        rawData,
        activeProtocol,
      );

      let productDetails: any = null;
      let netWeight = parsed.weight;
      let unitPrice = 0;
      let totalPrice = 0;

      if (productId) {
        const product = await this.productModel.findOne({
          _id: new Types.ObjectId(productId),
          companyId: new Types.ObjectId(companyId),
          isDeleted: false,
        });

        if (product) {
          const tare = product.tareWeight || 0;
          netWeight = Math.max(0, parsed.weight - tare);
          unitPrice = product.sellingPrice;
          totalPrice = Math.round(netWeight * unitPrice * 100) / 100;

          productDetails = {
            id: product._id,
            name: product.name,
            sku: product.sku,
            unitOfMeasure: product.scaleUnit || product.unitOfMeasure || 'KG',
            sellingPrice: unitPrice,
            tareWeight: tare,
          };
        }
      }

      return {
        success: true,
        message: 'Direct serial scale buffer parsed successfully',
        data: {
          rawString: parsed.raw,
          grossWeight: parsed.weight,
          netWeight,
          unit: parsed.unit,
          isStable: parsed.isStable,
          protocol: parsed.protocol,
          product: productDetails,
          unitPrice,
          totalPrice,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error parsing direct scale data');
    }
  }

  async calculateWeight(
    productId: string,
    grossWeight: number,
    companyId: string,
    userId: string,
    tareWeightOverride?: number,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(companyId, userId);

      const product = await this.productModel.findOne({
        _id: new Types.ObjectId(productId),
        companyId: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      if (!product) {
        throw new NotFoundException('Weighted product not found');
      }

      const tareDeduction =
        tareWeightOverride !== undefined
          ? tareWeightOverride
          : product.tareWeight || 0;

      const netWeight = Math.max(0, grossWeight - tareDeduction);
      const roundedNetWeight = Math.round(netWeight * 1000) / 1000;
      const unitPrice = product.sellingPrice;
      const totalPrice = Math.round(roundedNetWeight * unitPrice * 100) / 100;

      return {
        success: true,
        message: 'Weight and price calculated successfully',
        data: {
          productId: product._id,
          productName: product.name,
          grossWeight,
          tareWeight: tareDeduction,
          netWeight: roundedNetWeight,
          unitPrice,
          totalPrice,
          unitOfMeasure: product.scaleUnit || product.unitOfMeasure || 'KG',
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error calculating weighted price');
    }
  }
}
