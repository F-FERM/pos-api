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
  ProductSchemaName,
} from '../models/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { LogService } from '../log/log.service';
import { CompanyService } from '../company/company.service';
import { UserService } from '../user/user.service';
import { CategoryService } from '../category/category.service';
import { BrandService } from '../brand/brand.service';
import { SupplierService } from '../supplier/supplier.service';
import { AuthedRequest } from '../utils/common.types';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { Role } from '../utils/role.enum';

@Injectable()
export class ProductService extends GenericDatabase<Model<ProductDocument>> {
  constructor(
    @InjectModel(ProductSchemaName)
    private readonly productModel: Model<ProductDocument>,
    private readonly logService: LogService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly categoryService: CategoryService,
    private readonly brandService: BrandService,
    private readonly supplierService: SupplierService,
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
          barcode,
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
    dto: CreateProductDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      if (dto.categoryId) {
        const category = await this.categoryService.genericFindOne({
          _id: dto.categoryId,
          companyId: new Types.ObjectId(dto.companyId),
        });
        if (!category) {
          throw new BadRequestException('Category not found for this company');
        }
      }

      if (dto.brandId) {
        const brand = await this.brandService.genericFindOne({
          _id: dto.brandId,
          companyId: new Types.ObjectId(dto.companyId),
        });
        if (!brand) {
          throw new BadRequestException('Brand not found for this company');
        }
      }

      if (dto.supplierId) {
        const supplier = await this.supplierService.genericFindOne({
          _id: dto.supplierId,
          companyId: new Types.ObjectId(dto.companyId),
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found for this company');
        }
      }

      if (dto.barcode) {
        const dupBarcode = await this.genericFindOne({
          companyId: new Types.ObjectId(dto.companyId),
          barcode: dto.barcode.trim(),
        });
        if (dupBarcode) {
          throw new BadRequestException(
            'Product with this barcode already exists in your store',
          );
        }
      }

      if (dto.sku) {
        const dupSku = await this.genericFindOne({
          companyId: new Types.ObjectId(dto.companyId),
          sku: dto.sku.trim(),
        });
        if (dupSku) {
          throw new BadRequestException(
            'Product with this SKU already exists in your store',
          );
        }
      }

      const created = await this.genericCreateOne({
        ...dto,
        name: dto.name.trim(),
        sku: dto.sku?.trim(),
        barcode: dto.barcode?.trim(),
        partNumber: dto.partNumber?.trim(),
        size: dto.size?.trim(),
        color: dto.color?.trim(),
        description: dto.description?.trim(),
        categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : null,
        brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : null,
        supplierId: dto.supplierId ? new Types.ObjectId(dto.supplierId) : null,
        companyId: new Types.ObjectId(dto.companyId),
        unitOfMeasure: dto.unitOfMeasure?.trim() || 'PCS',
        costPrice: dto.costPrice ?? 0,
        sellingPrice: dto.sellingPrice,
        mrp: dto.mrp ?? dto.sellingPrice,
        taxRate: dto.taxRate ?? 0,
        isTaxInclusive: dto.isTaxInclusive ?? true,
        stockQuantity: dto.stockQuantity ?? 0,
        minStockAlert: dto.minStockAlert ?? 5,
        hasBatchExpiry: dto.hasBatchExpiry ?? false,
        isActive: dto.isActive ?? true,
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(created._id),
        description: `Product ${created.name} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

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
        filter.categoryId = new Types.ObjectId(categoryId);
      }

      if (brandId) {
        filter.brandId = new Types.ObjectId(brandId);
      }

      if (supplierId) {
        filter.supplierId = new Types.ObjectId(supplierId);
      }

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { partNumber: { $regex: search, $options: 'i' } },
        ];
      }

      if (lowStockOnly) {
        filter.$expr = { $lte: ['$stockQuantity', '$minStockAlert'] };
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.productModel
          .find(filter)
          .populate('categoryId', 'name code')
          .populate('brandId', 'name')
          .populate('supplierId', 'name phone contactPerson')
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

      const product = await this.productModel
        .findOne({
          companyId: new Types.ObjectId(companyId),
          barcode: barcode.trim(),
          isDeleted: false,
          isActive: true,
        })
        .populate('categoryId', 'name code')
        .populate('brandId', 'name')
        .populate('supplierId', 'name phone contactPerson');

      if (!product) {
        throw new NotFoundException(
          `Product with barcode '${barcode}' not found`,
        );
      }

      return {
        success: true,
        message: 'Product found',
        data: product,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
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

      const product = await this.productModel
        .findOne(filter)
        .populate('categoryId', 'name code')
        .populate('brandId', 'name')
        .populate('supplierId', 'name phone contactPerson');

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

      if (dto.categoryId) {
        const category = await this.categoryService.genericFindOne({
          _id: dto.categoryId,
          companyId: new Types.ObjectId(companyId),
        });
        if (!category) {
          throw new BadRequestException('Category not found for this company');
        }
      }

      if (dto.brandId) {
        const brand = await this.brandService.genericFindOne({
          _id: dto.brandId,
          companyId: new Types.ObjectId(companyId),
        });
        if (!brand) {
          throw new BadRequestException('Brand not found for this company');
        }
      }

      if (dto.supplierId) {
        const supplier = await this.supplierService.genericFindOne({
          _id: dto.supplierId,
          companyId: new Types.ObjectId(companyId),
        });
        if (!supplier) {
          throw new BadRequestException('Supplier not found for this company');
        }
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.sku !== undefined && { sku: dto.sku?.trim() }),
        ...(dto.barcode !== undefined && { barcode: dto.barcode?.trim() }),
        ...(dto.partNumber !== undefined && {
          partNumber: dto.partNumber?.trim(),
        }),
        ...(dto.size !== undefined && { size: dto.size?.trim() }),
        ...(dto.color !== undefined && { color: dto.color?.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(dto.categoryId !== undefined && {
          categoryId: dto.categoryId
            ? new Types.ObjectId(dto.categoryId)
            : null,
        }),
        ...(dto.brandId !== undefined && {
          brandId: dto.brandId ? new Types.ObjectId(dto.brandId) : null,
        }),
        ...(dto.supplierId !== undefined && {
          supplierId: dto.supplierId
            ? new Types.ObjectId(dto.supplierId)
            : null,
        }),
        ...(dto.unitOfMeasure && { unitOfMeasure: dto.unitOfMeasure.trim() }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_PRODUCT,
        entityType: LogEntityType.PRODUCT,
        entityId: new Types.ObjectId(id),
        description: `Product ${updated?.name} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

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
        description: `Product ${product.name} deleted`,
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
