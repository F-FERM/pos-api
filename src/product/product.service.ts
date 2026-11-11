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
  Product,
  ProductDocument,
  ProductModelConstants,
  ProductSchemaName,
} from '../models/product.schema';
import { CategoryModelConstants } from '../models/category.schema';
import { BrandModelConstants } from '../models/brand.schema';
import { SupplierModelConstants } from '../models/supplier.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { CategoryService } from '../category/category.service';
import { BrandService } from '../brand/brand.service';
import { SupplierService } from '../supplier/supplier.service';
import { SyncService } from '../sync/sync.service';
import { AuthedRequest } from '../utils/common.types';
import {
  LogActions,
  LogEntityType,
  LogStatus,
  ScaleBarcodeType,
} from '../utils/common.enum';
import { Role } from '../utils/role.enum';

import {
  UnitDocument,
  UnitModelConstants,
  UnitSchemaName,
} from '../models/unit.schema';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';

@Injectable()
export class ProductService extends GenericDatabase<Model<ProductDocument>> {
  constructor(
    @InjectModel(ProductSchemaName)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(UnitSchemaName)
    private readonly unitModel: Model<UnitDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly categoryService: CategoryService,
    private readonly brandService: BrandService,
    private readonly supplierService: SupplierService,
    private readonly syncService: SyncService,
  ) {
    super(productModel);
  }

  private generateEan13Barcode(): string {
    const prefix = '20';
    const randomBody = Math.floor(Math.random() * 10000000000)
      .toString()
      .padStart(10, '0');
    const first12 = `${prefix}${randomBody}`;

    let oddSum = 0;
    let evenSum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(first12[i], 10);
      if (i % 2 === 0) {
        oddSum += digit;
      } else {
        evenSum += digit;
      }
    }
    const total = oddSum + evenSum * 3;
    const checkDigit = (10 - (total % 10)) % 10;

    return `${first12}${checkDigit}`;
  }

  async generateUniqueBarcode(userId: string, companyId: string) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      let isUnique = false;
      let barcode = '';
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        barcode = this.generateEan13Barcode();
        const filter: Record<string, unknown> = {
          'basicInfo.barcode': barcode,
          isDeleted: false,
        };
        if (this.isValidMongoId(companyId)) {
          filter.companyId = new Types.ObjectId(companyId);
        }

        const existing = await this.productModel.findOne(filter);

        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new BadRequestException('Failed to generate unique barcode');
      }

      return {
        success: true,
        message: 'Unique barcode generated successfully',
        data: { barcode },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error generating barcode');
    }
  }

  async createProduct(
    dto: CreateProductDto & { companyId: string },
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const unitId = dto.basicInfo?.unitId;
      if (!unitId) {
        throw new BadRequestException('Unit ID is required');
      }

      const name = dto.basicInfo?.name;
      if (!name) {
        throw new BadRequestException('Product name is required');
      }

      const sellingPrice = dto.pricingAndTax?.sellingPrice;
      if (sellingPrice === undefined || sellingPrice < 0) {
        throw new BadRequestException('Selling price is required');
      }

      const unit = await this.unitModel.findOne({
        _id: new Types.ObjectId(unitId),
        companyId: new Types.ObjectId(dto.companyId),
        isDeleted: false,
      });

      if (!unit) {
        throw new BadRequestException('Unit not found in your store');
      }

      const categoryId = dto.basicInfo?.categoryId;
      if (categoryId) {
        const category = await this.categoryService.genericFindOne({
          _id: categoryId,
          companyId: new Types.ObjectId(dto.companyId),
        });
        if (!category) {
          throw new BadRequestException('Category not found for this company');
        }
      }

      const brandId = dto.basicInfo?.brandId;
      if (brandId) {
        const brand = await this.brandService.genericFindOne({
          _id: brandId,
          companyId: new Types.ObjectId(dto.companyId),
        });
        if (!brand) {
          throw new BadRequestException('Brand not found for this company');
        }
      }

      const supplierId = dto.basicInfo?.supplierId;
      if (supplierId) {
        const supplier = await this.supplierService.genericFindOne({
          _id: supplierId,
          companyId: new Types.ObjectId(dto.companyId),
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found for this company');
        }
      }

      const barcode = dto.basicInfo?.barcode?.trim();
      if (barcode) {
        const dupBarcode = await this.genericFindOne({
          companyId: new Types.ObjectId(dto.companyId),
          'basicInfo.barcode': barcode,
        });
        if (dupBarcode) {
          throw new BadRequestException(
            'Product with this barcode already exists in your store',
          );
        }
      }

      const sku = dto.basicInfo?.sku?.trim();
      if (sku) {
        const dupSku = await this.genericFindOne({
          companyId: new Types.ObjectId(dto.companyId),
          'basicInfo.sku': sku,
        });
        if (dupSku) {
          throw new BadRequestException(
            'Product with this SKU already exists in your store',
          );
        }
      }

      const scalePlu = dto.scalePlu?.trim();
      if (scalePlu) {
        const dupPlu = await this.genericFindOne({
          companyId: new Types.ObjectId(dto.companyId),
          scalePlu,
        });
        if (dupPlu) {
          throw new BadRequestException(
            'Product with this scale PLU code already exists in your store',
          );
        }
      }

      const purchasePrice = dto.pricingAndTax?.purchasePrice ?? 0;
      const vatRate = dto.pricingAndTax?.vatRate ?? 0;
      const sellingPriceBeforeVat =
        dto.pricingAndTax?.sellingPriceBeforeVat ?? sellingPrice;
      const vatAmount =
        dto.pricingAndTax?.vatAmount ??
        Math.round(sellingPriceBeforeVat * (vatRate / 100) * 100) / 100;
      const priceIncludingVat =
        dto.pricingAndTax?.priceIncludingVat ??
        Math.round((sellingPriceBeforeVat + vatAmount) * 100) / 100;
      const profitMargin =
        dto.pricingAndTax?.profitMargin ??
        (sellingPrice > 0
          ? Math.round(
              ((sellingPrice - purchasePrice) / sellingPrice) * 100 * 10,
            ) / 10
          : 0);

      const enableStockTracking =
        dto.inventoryManagement?.enableStockTracking ?? true;
      const openingStock = dto.inventoryManagement?.openingStock ?? 0;
      const lowStockAlert = dto.inventoryManagement?.lowStockAlert ?? 10;
      const description = (dto.inventoryManagement?.description ?? '').trim();
      const isActive = dto.isActive ?? true;

      const created = await this.genericCreateOne({
        companyId: new Types.ObjectId(dto.companyId),
        basicInfo: {
          name: name.trim(),
          image: dto.basicInfo?.image?.trim() || '',
          sku: sku || undefined,
          barcode: barcode || undefined,
          categoryId: categoryId ? new Types.ObjectId(categoryId) : null,
          brandId: brandId ? new Types.ObjectId(brandId) : null,
          unitId: new Types.ObjectId(unitId),
          supplierId: supplierId ? new Types.ObjectId(supplierId) : null,
        },
        pricingAndTax: {
          purchasePrice,
          sellingPrice,
          vatRate,
          profitMargin,
          sellingPriceBeforeVat,
          vatAmount,
          priceIncludingVat,
        },
        inventoryManagement: {
          enableStockTracking,
          openingStock,
          lowStockAlert,
          description,
        },
        isWeighted: dto.isWeighted ?? false,
        scalePlu: scalePlu || undefined,
        scaleUnit: dto.scaleUnit?.trim() || 'KG',
        tareWeight: dto.tareWeight ?? 0,
        isActive,
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(created._id),
        description: `Product ${created.basicInfo?.name || name} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Product created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(),
        description: `Failed to create product`,
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
      throw new BadRequestException('Error creating product');
    }
  }

  async findAllProducts(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    search?: string,
    categoryId?: string,
    brandId?: string,
    supplierId?: string,
    lowStockOnly?: boolean,
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

      if (categoryId) {
        filter['basicInfo.categoryId'] = new Types.ObjectId(categoryId);
      }

      if (brandId) {
        filter['basicInfo.brandId'] = new Types.ObjectId(brandId);
      }

      if (supplierId) {
        filter['basicInfo.supplierId'] = new Types.ObjectId(supplierId);
      }

      if (search) {
        filter.$or = [
          { 'basicInfo.name': { $regex: search, $options: 'i' } },
          { 'basicInfo.barcode': { $regex: search, $options: 'i' } },
          { 'basicInfo.sku': { $regex: search, $options: 'i' } },
        ];
      }

      if (lowStockOnly) {
        filter.$expr = {
          $lte: [
            '$inventoryManagement.openingStock',
            '$inventoryManagement.lowStockAlert',
          ],
        };
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.productModel
          .find(filter)
          .populate([
            {
              path: ProductModelConstants.unitId,
              select: `${UnitModelConstants.name} ${UnitModelConstants.symbol}`,
            },
            {
              path: ProductModelConstants.categoryId,
              select: `${CategoryModelConstants.name} ${CategoryModelConstants.code}`,
            },
            {
              path: ProductModelConstants.brandId,
              select: BrandModelConstants.name,
            },
            {
              path: ProductModelConstants.supplierId,
              select: `${SupplierModelConstants.name} ${SupplierModelConstants.phone} ${SupplierModelConstants.contactPerson}`,
            },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.productModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Products fetched successfully',
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
      throw new BadRequestException('Error fetching products');
    }
  }

  async findProductByBarcode(
    barcode: string,
    userId: string,
    companyId: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);

      const rawBarcode = barcode.trim();

      const company = await this.companyModel.findOne({
        _id: new Types.ObjectId(companyId),
        isDeleted: false,
      });

      const scaleSettings = company?.weighScaleSettings || {
        enabled: true,
        barcodePrefix: '21',
        barcodeType: ScaleBarcodeType.WEIGHT_EMBEDDED,
        pluLength: 5,
        weightMultiplier: 0.001,
      };

      const prefix = scaleSettings.barcodePrefix || '21';
      const pluLength = scaleSettings.pluLength || 5;

      const isScaleBarcode =
        rawBarcode.startsWith(prefix) ||
        (rawBarcode.length === 13 && /^2[0-9]/.test(rawBarcode));

      if (isScaleBarcode) {
        const prefixLen = prefix.length;
        const pluCode = rawBarcode.substring(prefixLen, prefixLen + pluLength);
        const valueDigits = rawBarcode.substring(prefixLen + pluLength, 12);
        const rawNum = parseFloat(valueDigits) || 0;

        const product = await this.productModel
          .findOne({
            companyId: new Types.ObjectId(companyId),
            $or: [
              { scalePlu: pluCode },
              { scalePlu: pluCode.replace(/^0+/, '') },
              { 'basicInfo.barcode': pluCode },
              { 'basicInfo.barcode': rawBarcode },
              { 'basicInfo.sku': pluCode },
            ],
            isDeleted: false,
            isActive: true,
          })
          .populate([
            {
              path: ProductModelConstants.categoryId,
              select: `${CategoryModelConstants.name} ${CategoryModelConstants.code}`,
            },
            {
              path: ProductModelConstants.brandId,
              select: BrandModelConstants.name,
            },
            {
              path: ProductModelConstants.supplierId,
              select: `${SupplierModelConstants.name} ${SupplierModelConstants.phone} ${SupplierModelConstants.contactPerson}`,
            },
          ]);

        if (product) {
          let netQuantity = 1;
          const sellingPrice = product.pricingAndTax?.sellingPrice ?? 0;
          let totalPrice = sellingPrice;
          const unitPrice = sellingPrice;

          if (scaleSettings.barcodeType === ScaleBarcodeType.PRICE_EMBEDDED) {
            totalPrice = Math.round((rawNum / 100) * 100) / 100;
            netQuantity =
              unitPrice > 0
                ? Math.round((totalPrice / unitPrice) * 1000) / 1000
                : 1;
          } else {
            const grossWeight =
              rawNum * (scaleSettings.weightMultiplier || 0.001);
            const tare = product.tareWeight || 0;
            netQuantity = Math.max(0.001, grossWeight - tare);
            netQuantity = Math.round(netQuantity * 1000) / 1000;
            totalPrice = Math.round(netQuantity * unitPrice * 100) / 100;
          }

          return {
            success: true,
            message: 'Scale product scanned successfully',
            data: {
              ...product.toObject(),
              isScaleBarcode: true,
              scannedQuantity: netQuantity,
              scannedUnitPrice: unitPrice,
              scannedTotalPrice: totalPrice,
            },
            statusCode: HttpStatus.OK,
          };
        }
      }

      // Exact barcode lookup fallback
      const product = await this.productModel
        .findOne({
          companyId: new Types.ObjectId(companyId),
          'basicInfo.barcode': rawBarcode,
          isDeleted: false,
          isActive: true,
        })
        .populate([
          {
            path: ProductModelConstants.categoryId,
            select: `${CategoryModelConstants.name} ${CategoryModelConstants.code}`,
          },
          {
            path: ProductModelConstants.brandId,
            select: BrandModelConstants.name,
          },
          {
            path: ProductModelConstants.supplierId,
            select: `${SupplierModelConstants.name} ${SupplierModelConstants.phone} ${SupplierModelConstants.contactPerson}`,
          },
        ]);

      if (!product) {
        throw new NotFoundException(
          `Product with barcode '${rawBarcode}' not found`,
        );
      }

      return {
        success: true,
        message: 'Product found',
        data: product,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error finding product by barcode');
    }
  }

  async findOneProduct(
    id: string,
    userId: string,
    companyId: string,
    roles: string[],
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin = roles.includes(Role.superadmin);

      const filter: Record<string, unknown> = {
        _id: id,
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        filter.companyId = new Types.ObjectId(companyId);
      }

      const product = await this.productModel.findOne(filter).populate([
        {
          path: ProductModelConstants.categoryId,
          select: `${CategoryModelConstants.name} ${CategoryModelConstants.code}`,
        },
        {
          path: ProductModelConstants.brandId,
          select: BrandModelConstants.name,
        },
        {
          path: ProductModelConstants.supplierId,
          select: `${SupplierModelConstants.name} ${SupplierModelConstants.phone} ${SupplierModelConstants.contactPerson}`,
        },
      ]);

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      return {
        success: true,
        message: 'Product fetched successfully',
        data: product,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching product');
    }
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const product = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const categoryId = dto.basicInfo?.categoryId;
      if (categoryId) {
        const category = await this.categoryService.genericFindOne({
          _id: categoryId,
          companyId: new Types.ObjectId(companyId),
        });
        if (!category) {
          throw new BadRequestException('Category not found for this company');
        }
      }

      const brandId = dto.basicInfo?.brandId;
      if (brandId) {
        const brand = await this.brandService.genericFindOne({
          _id: brandId,
          companyId: new Types.ObjectId(companyId),
        });
        if (!brand) {
          throw new BadRequestException('Brand not found for this company');
        }
      }

      const supplierId = dto.basicInfo?.supplierId;
      if (supplierId) {
        const supplier = await this.supplierService.genericFindOne({
          _id: supplierId,
          companyId: new Types.ObjectId(companyId),
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found for this company');
        }
      }

      const barcode = dto.basicInfo?.barcode?.trim();
      if (barcode) {
        const dupBarcode = await this.genericFindOne({
          companyId: new Types.ObjectId(companyId),
          _id: { $ne: new Types.ObjectId(id) },
          'basicInfo.barcode': barcode,
        });
        if (dupBarcode) {
          throw new BadRequestException(
            'Another product with this barcode already exists in your store',
          );
        }
      }

      const sku = dto.basicInfo?.sku?.trim();
      if (sku) {
        const dupSku = await this.genericFindOne({
          companyId: new Types.ObjectId(companyId),
          _id: { $ne: new Types.ObjectId(id) },
          'basicInfo.sku': sku,
        });
        if (dupSku) {
          throw new BadRequestException(
            'Another product with this SKU already exists in your store',
          );
        }
      }

      if (dto.scalePlu) {
        const dupPlu = await this.genericFindOne({
          companyId: new Types.ObjectId(companyId),
          _id: { $ne: new Types.ObjectId(id) },
          scalePlu: dto.scalePlu.trim(),
        });
        if (dupPlu) {
          throw new BadRequestException(
            'Another product with this scale PLU code already exists in your store',
          );
        }
      }

      const updateFields: Record<string, any> = {};

      if (dto.basicInfo) {
        if (dto.basicInfo.name !== undefined)
          updateFields['basicInfo.name'] = dto.basicInfo.name.trim();
        if (dto.basicInfo.sku !== undefined)
          updateFields['basicInfo.sku'] = dto.basicInfo.sku?.trim();
        if (dto.basicInfo.barcode !== undefined)
          updateFields['basicInfo.barcode'] = dto.basicInfo.barcode?.trim();
        if (dto.basicInfo.image !== undefined)
          updateFields['basicInfo.image'] = dto.basicInfo.image?.trim();
        if (dto.basicInfo.unitId !== undefined)
          updateFields['basicInfo.unitId'] = new Types.ObjectId(
            dto.basicInfo.unitId,
          );
        if (dto.basicInfo.categoryId !== undefined) {
          updateFields['basicInfo.categoryId'] = dto.basicInfo.categoryId
            ? new Types.ObjectId(dto.basicInfo.categoryId)
            : null;
        }
        if (dto.basicInfo.brandId !== undefined) {
          updateFields['basicInfo.brandId'] = dto.basicInfo.brandId
            ? new Types.ObjectId(dto.basicInfo.brandId)
            : null;
        }
        if (dto.basicInfo.supplierId !== undefined) {
          updateFields['basicInfo.supplierId'] = dto.basicInfo.supplierId
            ? new Types.ObjectId(dto.basicInfo.supplierId)
            : null;
        }
      }

      if (dto.pricingAndTax) {
        if (dto.pricingAndTax.purchasePrice !== undefined)
          updateFields['pricingAndTax.purchasePrice'] =
            dto.pricingAndTax.purchasePrice;
        if (dto.pricingAndTax.sellingPrice !== undefined)
          updateFields['pricingAndTax.sellingPrice'] =
            dto.pricingAndTax.sellingPrice;
        if (dto.pricingAndTax.vatRate !== undefined)
          updateFields['pricingAndTax.vatRate'] = dto.pricingAndTax.vatRate;
        if (dto.pricingAndTax.profitMargin !== undefined)
          updateFields['pricingAndTax.profitMargin'] =
            dto.pricingAndTax.profitMargin;
        if (dto.pricingAndTax.sellingPriceBeforeVat !== undefined)
          updateFields['pricingAndTax.sellingPriceBeforeVat'] =
            dto.pricingAndTax.sellingPriceBeforeVat;
        if (dto.pricingAndTax.vatAmount !== undefined)
          updateFields['pricingAndTax.vatAmount'] = dto.pricingAndTax.vatAmount;
        if (dto.pricingAndTax.priceIncludingVat !== undefined)
          updateFields['pricingAndTax.priceIncludingVat'] =
            dto.pricingAndTax.priceIncludingVat;
      }

      if (dto.inventoryManagement) {
        if (dto.inventoryManagement.enableStockTracking !== undefined)
          updateFields['inventoryManagement.enableStockTracking'] =
            dto.inventoryManagement.enableStockTracking;
        if (dto.inventoryManagement.openingStock !== undefined)
          updateFields['inventoryManagement.openingStock'] =
            dto.inventoryManagement.openingStock;
        if (dto.inventoryManagement.lowStockAlert !== undefined)
          updateFields['inventoryManagement.lowStockAlert'] =
            dto.inventoryManagement.lowStockAlert;
        if (dto.inventoryManagement.description !== undefined)
          updateFields['inventoryManagement.description'] =
            dto.inventoryManagement.description?.trim();
      }

      if (dto.isActive !== undefined) updateFields['isActive'] = dto.isActive;
      if (dto.isWeighted !== undefined)
        updateFields['isWeighted'] = dto.isWeighted;
      if (dto.scalePlu !== undefined)
        updateFields['scalePlu'] = dto.scalePlu?.trim();
      if (dto.scaleUnit !== undefined)
        updateFields['scaleUnit'] = dto.scaleUnit?.trim();
      if (dto.tareWeight !== undefined)
        updateFields['tareWeight'] = dto.tareWeight;

      const updated = await this.genericUpdateOne(id, updateFields);

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(id),
        description: `Product ${updated?.basicInfo?.name || product?.basicInfo?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      this.syncService.syncAllUnsyncedRecords().catch(() => null);

      return {
        success: true,
        message: 'Product updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(id),
        description: `Failed to update product`,
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
      throw new BadRequestException('Error updating product');
    }
  }

  async deleteProduct(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const product = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(id),
        description: `Product ${product.basicInfo?.name || product.name} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Product deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(id),
        description: `Failed to delete product`,
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
      throw new BadRequestException('Error deleting product');
    }
  }
}
