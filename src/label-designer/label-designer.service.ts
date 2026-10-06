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
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import { GenerateLabelDto } from './dto/generate-label.dto';
import { generateCode128Svg } from './utils/barcode-generator';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { LogService } from '../log/log.service';
import { LogActions, LogEntityType, LogStatus } from '../utils/common.enum';
import { AuthedRequest } from '../utils/common.types';
import { DEFAULT_TEST_LABEL_DATA } from '../common/seeds/label-designer.data';

export interface GeneratedLabelUnit {
  productId: string;
  productName: string;
  companyName: string;
  barcode: string;
  barcodeSvg: string;
  price: string;
  rawPrice: number;
}

@Injectable()
export class LabelDesignerService extends GenericDatabase<
  Model<ProductDocument>
> {
  constructor(
    @InjectModel(ProductSchemaName)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly userService: UserService,
    private readonly companyService: CompanyService,
    private readonly logService: LogService,
  ) {
    super(productModel);
  }

  async generateLabels(
    dto: GenerateLabelDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      const company = await this.companyModel.findOne({
        _id: new Types.ObjectId(dto.companyId),
        isDeleted: false,
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const storeName = company.name?.trim() || 'MY SUPERMARKET STORE';
      const currency = company.regional?.currencySymbol || '₹';
      const labelSize = dto.labelSize || '50x25';
      const columns = dto.columns || 1;

      const labelsList: GeneratedLabelUnit[] = [];

      for (const itemDto of dto.items) {
        const product = await this.productModel.findOne({
          _id: new Types.ObjectId(itemDto.productId),
          companyId: new Types.ObjectId(dto.companyId),
          isDeleted: false,
        });

        if (!product) {
          throw new BadRequestException(
            `Product with ID ${itemDto.productId} not found`,
          );
        }

        const barcodeValue =
          product.barcode?.trim() ||
          product.sku?.trim() ||
          product._id.toString().slice(-12).toUpperCase();

        const barcodeSvg = generateCode128Svg(barcodeValue, 42);
        const formattedPrice = `PRICE: ${currency}${product.sellingPrice}`;

        for (let i = 0; i < itemDto.quantity; i++) {
          labelsList.push({
            productId: product._id.toString(),
            productName: product.name,
            companyName: storeName,
            barcode: barcodeValue,
            barcodeSvg,
            price: formattedPrice,
            rawPrice: product.sellingPrice,
          });
        }
      }

      const htmlTemplate = this.buildPrintableHtml(labelsList, columns);

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.GENERATE_LABEL,
        entityType: LogEntityType.LABEL_DESIGNER,
        entityId: new Types.ObjectId(),
        description: `Generated ${labelsList.length} sticker labels for printing`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Barcode sticker labels generated successfully',
        data: {
          totalLabelsCount: labelsList.length,
          labelSize,
          columns,
          labels: labelsList,
          html: htmlTemplate,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.GENERATE_LABEL,
        entityType: LogEntityType.LABEL_DESIGNER,
        entityId: new Types.ObjectId(),
        description: 'Failed to generate sticker labels',
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
      throw new BadRequestException('Error generating barcode labels');
    }
  }

  async generateTestLabel(companyId?: string) {
    try {
      let storeName = DEFAULT_TEST_LABEL_DATA.companyName;
      let currency = '₹';

      if (companyId && this.isValidMongoId(companyId)) {
        const company = await this.companyModel.findOne({
          _id: new Types.ObjectId(companyId),
          isDeleted: false,
        });
        if (company?.name) {
          storeName = company.name.trim();
        }
        if (company?.regional?.currencySymbol) {
          currency = company.regional.currencySymbol;
        }
      }

      const barcodeSvg = generateCode128Svg(DEFAULT_TEST_LABEL_DATA.barcode, 42);
      const formattedPrice = `PRICE: ${currency}${DEFAULT_TEST_LABEL_DATA.rawPrice}`;

      const labelUnit: GeneratedLabelUnit = {
        productId: 'test-product-001',
        productName: DEFAULT_TEST_LABEL_DATA.productName,
        companyName: storeName,
        barcode: DEFAULT_TEST_LABEL_DATA.barcode,
        barcodeSvg,
        price: formattedPrice,
        rawPrice: DEFAULT_TEST_LABEL_DATA.rawPrice,
      };

      const htmlTemplate = this.buildPrintableHtml([labelUnit], 1);

      return {
        success: true,
        message: 'Test barcode sticker label generated successfully',
        data: {
          totalLabelsCount: 1,
          labelSize: '50x25',
          columns: 1,
          labels: [labelUnit],
          html: htmlTemplate,
        },
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error generating test barcode label');
    }
  }

  private buildPrintableHtml(
    labels: GeneratedLabelUnit[],
    columns = 1,
  ): string {
    const labelsHtml = labels
      .map(
        (lbl) => `
      <div class="sticker-card">
        <div class="company-name">${lbl.companyName}</div>
        <div class="product-name">${lbl.productName}</div>
        <div class="barcode-container">${lbl.barcodeSvg}</div>
        <div class="barcode-value">${lbl.barcode}</div>
        <div class="product-price">${lbl.price}</div>
      </div>`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Barcode Thermal Sticker Labels</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background-color: #f8fafc;
      padding: 16px;
      color: #0f172a;
    }
    .grid-container {
      display: grid;
      grid-template-columns: repeat(${columns}, minmax(0, 1fr));
      gap: 12px;
      max-width: 800px;
      margin: 0 auto;
    }
    .sticker-card {
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      padding: 10px 8px;
      text-align: center;
      width: 100%;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-inside: avoid;
    }
    .company-name {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #1e293b;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .product-name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 6px;
      max-height: 32px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .barcode-container {
      width: 90%;
      height: 42px;
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 2px 0;
    }
    .barcode-container svg {
      width: 100%;
      height: 42px;
    }
    .barcode-value {
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      color: #334155;
      margin-top: 2px;
      margin-bottom: 4px;
    }
    .product-price {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .grid-container {
        gap: 0;
      }
      .sticker-card {
        box-shadow: none;
        border: none;
      }
    }
  </style>
</head>
<body>
  <div class="grid-container">
    ${labelsHtml}
  </div>
</body>
</html>`;
  }
}
