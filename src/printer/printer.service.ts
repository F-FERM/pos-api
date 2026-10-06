import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
} from 'node-thermal-printer';
import { GenericDatabase } from '../helper/genericDatabase';
import {
  Printer,
  PrinterDocument,
  PrinterModelConstants,
  PrinterSchemaName,
} from '../models/printer.schema';
import { CompanyDocument, CompanySchemaName } from '../models/company.schema';
import { CounterModelConstants } from '../models/counter.schema';
import { UserModelConstants } from '../models/user.schema';
import { CreatePrinterDto } from './dto/create-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { UserService } from '../user/user.service';
import { CompanyService } from '../company/company.service';
import { LogService } from '../log/log.service';
import {
  LogActions,
  LogEntityType,
  LogStatus,
  PaperWidth,
} from '../utils/common.enum';
import { AuthedRequest } from '../utils/common.types';

export interface PrintReceiptPayload {
  sale: any;
  company: any;
  customer?: any;
}

export interface PrintReceiptResult {
  success: boolean;
  message: string;
  data: {
    invoiceNumber: string;
    receiptText: string;
    printedAt: Date;
    isReprint: boolean;
    printer?: {
      id: string;
      name: string;
      ip: string;
      counterId?: string;
      paperWidth: PaperWidth;
    };
    physicalPrintStatus?: 'sent' | 'failed' | 'skipped';
    physicalPrintError?: string | null;
  };
  statusCode: HttpStatus;
}

@Injectable()
export class PrinterService extends GenericDatabase<Model<PrinterDocument>> {
  constructor(
    @InjectModel(PrinterSchemaName)
    private readonly printerModel: Model<PrinterDocument>,
    @InjectModel(CompanySchemaName)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly userService: UserService,
    private readonly companyService: CompanyService,
    private readonly logService: LogService,
  ) {
    super(printerModel);
  }

  async resolvePrinterForCounter(
    companyId: string,
    counterId?: string,
  ): Promise<PrinterDocument | null> {
    const companyObjectId = new Types.ObjectId(companyId);

    if (counterId && Types.ObjectId.isValid(counterId)) {
      const counterPrinter = await this.printerModel.findOne({
        companyId: companyObjectId,
        counterId: new Types.ObjectId(counterId),
        isDeleted: false,
        isActive: true,
      });

      if (counterPrinter) return counterPrinter;
    }

    const defaultPrinter = await this.printerModel.findOne({
      companyId: companyObjectId,
      isDefault: true,
      isDeleted: false,
      isActive: true,
    });

    return defaultPrinter ?? null;
  }

  private getLineWidth(paperWidth: PaperWidth): number {
    return paperWidth === PaperWidth.MM_58 ? 32 : 48;
  }

  private leftCell(value: any, width: number): string {
    const raw = String(value ?? '');
    if (width <= 0) return '';
    return raw.length >= width
      ? raw.slice(0, width)
      : raw + ' '.repeat(width - raw.length);
  }

  private rightCell(value: any, width: number): string {
    const raw = String(value ?? '');
    if (width <= 0) return '';
    return raw.length >= width
      ? raw.slice(raw.length - width)
      : ' '.repeat(width - raw.length) + raw;
  }

  private twoColumn(left: string, right: string, totalWidth: number): string {
    const safeLeft = String(left ?? '');
    const safeRight = String(right ?? '');
    const rightLen = safeRight.length;
    const leftWidth = Math.max(totalWidth - rightLen, 0);

    const leftPart =
      safeLeft.length > leftWidth
        ? safeLeft.substring(0, Math.max(leftWidth - 2, 0)) + '..'
        : safeLeft;

    return this.leftCell(leftPart, leftWidth) + safeRight;
  }

  private divider(char: string, paperWidth: PaperWidth): string {
    const width = this.getLineWidth(paperWidth);
    return char.repeat(width);
  }

  private formatBillDate(value: any): string {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return String(value ?? '');
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${mins}`;
  }

  formatRetailReceipt(
    payload: PrintReceiptPayload,
    options: { paperWidth?: PaperWidth; reprint?: boolean },
  ): string {
    const { sale, company, customer } = payload;
    const paperWidth = options.paperWidth ?? PaperWidth.MM_80;
    const width = this.getLineWidth(paperWidth);
    const currency = company?.regional?.currencySymbol || '₹';

    const lines: string[] = [];

    const storeName = company?.name || 'STORE / SUPERMARKET';
    lines.push(storeName.toUpperCase());
    if (company?.address?.line1) {
      lines.push(company.address.line1);
    }
    if (company?.contact?.primaryPhone) {
      lines.push(`TEL: ${company.contact.primaryPhone}`);
    }
    if (company?.taxIdentifiers?.vatNumber) {
      lines.push(`GST/VAT: ${company.taxIdentifiers.vatNumber}`);
    }

    lines.push(this.divider('-', paperWidth));

    lines.push(
      this.twoColumn(
        `INV: ${sale.invoiceNumber}`,
        `DATE: ${this.formatBillDate(sale.createdAt)}`,
        width,
      ),
    );

    if (options.reprint) {
      lines.push('*** REPRINT ***');
    }

    if (customer?.name) {
      lines.push(`CUST: ${customer.name} (${customer.phone || ''})`);
    }

    lines.push(this.divider('-', paperWidth));

    if (paperWidth === PaperWidth.MM_58) {
      lines.push('Item             Qty Price   Total');
    } else {
      lines.push('Item Name             Qty   Price     Total');
    }

    lines.push(this.divider('-', paperWidth));

    for (const item of sale.items || []) {
      const name = item.productName || 'Item';
      const qty = item.quantity || 1;
      const price = (item.unitPrice || 0).toFixed(2);
      const total = (item.totalAmount || 0).toFixed(2);

      if (paperWidth === PaperWidth.MM_58) {
        lines.push(`${this.leftCell(name, 16)} ${qty}x${price} ${total}`);
      } else {
        lines.push(
          `${this.leftCell(name, 20)} ${this.rightCell(
            qty,
            4,
          )} ${this.rightCell(price, 8)} ${this.rightCell(total, 9)}`,
        );
      }
    }

    lines.push(this.divider('-', paperWidth));

    lines.push(
      this.twoColumn(
        'Subtotal',
        `${currency}${sale.subtotal.toFixed(2)}`,
        width,
      ),
    );

    if (sale.discountTotal > 0) {
      lines.push(
        this.twoColumn(
          'Discount',
          `-${currency}${sale.discountTotal.toFixed(2)}`,
          width,
        ),
      );
    }

    if (sale.taxTotal > 0) {
      lines.push(
        this.twoColumn(
          'Tax / VAT',
          `${currency}${sale.taxTotal.toFixed(2)}`,
          width,
        ),
      );
    }

    lines.push(this.divider('=', paperWidth));
    lines.push(
      this.twoColumn(
        'TOTAL',
        `${currency}${sale.grandTotal.toFixed(2)}`,
        width,
      ),
    );
    lines.push(this.divider('=', paperWidth));

    lines.push(
      this.twoColumn(
        'Paid Amount',
        `${currency}${sale.paidAmount.toFixed(2)}`,
        width,
      ),
    );

    if (sale.changeAmount > 0) {
      lines.push(
        this.twoColumn(
          'Change Due',
          `${currency}${sale.changeAmount.toFixed(2)}`,
          width,
        ),
      );
    }

    lines.push(this.twoColumn('Payment Method', sale.paymentMethod, width));

    if (customer?.loyaltyPoints) {
      lines.push(
        this.twoColumn(
          'Loyalty Points',
          `${customer.loyaltyPoints.toFixed(1)} Pts`,
          width,
        ),
      );
    }

    lines.push(this.divider('-', paperWidth));
    lines.push(`[BARCODE: ${sale.invoiceNumber}]`);
    lines.push('Thank You For Shopping With Us!');
    lines.push('Please Visit Again');

    return lines.join('\n') + '\n';
  }

  private async sendToThermalPrinter(
    printerIp: string,
    paperWidth: PaperWidth,
    payload: PrintReceiptPayload,
    isReprint = false,
  ): Promise<void> {
    const lineWidth = this.getLineWidth(paperWidth);
    const isIpAddress = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(printerIp);

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: isIpAddress
        ? `tcp://${printerIp}:9100`
        : `printer:${printerIp}`,
      characterSet: CharacterSet.PC437_USA,
      removeSpecialCharacters: false,
      lineCharacter: '-',
      width: lineWidth,
      options: { timeout: 5000 },
    });

    if (isIpAddress) {
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected) {
        throw new Error(`Printer at ${printerIp}:9100 is not reachable`);
      }
    }

    const { sale, company, customer } = payload;
    const currency = company?.regional?.currencySymbol || '₹';

    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println((company?.name || 'STORE').toUpperCase());
    printer.setTextSize(0, 0);
    printer.bold(false);

    if (company?.address?.line1) printer.println(company.address.line1);
    if (company?.contact?.primaryPhone)
      printer.println(`TEL: ${company.contact.primaryPhone}`);

    printer.drawLine();

    printer.alignLeft();
    printer.println(
      this.twoColumn(
        `INV: ${sale.invoiceNumber}`,
        `DATE: ${this.formatBillDate(sale.createdAt)}`,
        lineWidth,
      ),
    );

    if (isReprint) {
      printer.alignCenter();
      printer.bold(true);
      printer.println('*** REPRINT ***');
      printer.bold(false);
      printer.alignLeft();
    }

    if (customer?.name) {
      printer.println(`CUST: ${customer.name}`);
    }

    printer.drawLine();

    for (const item of sale.items || []) {
      const name = item.productName || 'Item';
      const qty = item.quantity || 1;
      const price = (item.unitPrice || 0).toFixed(2);
      const total = (item.totalAmount || 0).toFixed(2);
      printer.println(
        this.twoColumn(`${name} x${qty}`, `${currency}${total}`, lineWidth),
      );
    }

    printer.drawLine();
    printer.println(
      this.twoColumn(
        'TOTAL',
        `${currency}${sale.grandTotal.toFixed(2)}`,
        lineWidth,
      ),
    );
    printer.println(
      this.twoColumn(
        'PAID',
        `${currency}${sale.paidAmount.toFixed(2)}`,
        lineWidth,
      ),
    );
    printer.println(this.twoColumn('METHOD', sale.paymentMethod, lineWidth));

    printer.drawLine();
    printer.alignCenter();
    printer.code128(sale.invoiceNumber, {
      width: paperWidth === PaperWidth.MM_58 ? 'SMALL' : 'MEDIUM',
      height: 50,
      text: 2,
    });
    printer.println('Thank You For Shopping!');
    printer.cut();

    await printer.execute();
  }

  async printSaleReceipt(
    sale: any,
    companyId: string,
    counterId?: string,
    isReprint = false,
  ): Promise<PrintReceiptResult> {
    const company = await this.companyModel.findOne({
      _id: new Types.ObjectId(companyId),
      isDeleted: false,
    });

    const printer = await this.resolvePrinterForCounter(companyId, counterId);
    const paperWidth = printer?.paperWidth || PaperWidth.MM_80;

    const payload: PrintReceiptPayload = {
      sale,
      company: company?.toObject() || {},
      customer: sale.customerId,
    };

    const receiptText = this.formatRetailReceipt(payload, {
      paperWidth,
      reprint: isReprint,
    });

    let printerInfo: any = undefined;
    let physicalPrintStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
    let physicalPrintError: string | null = null;

    if (printer) {
      printerInfo = {
        id: printer._id.toString(),
        name: printer.printerName,
        ip: printer.printerIp,
        counterId: printer.counterId?.toString(),
        paperWidth,
      };

      try {
        await this.sendToThermalPrinter(
          printer.printerIp,
          paperWidth,
          payload,
          isReprint,
        );
        physicalPrintStatus = 'sent';
      } catch (err: any) {
        physicalPrintStatus = 'failed';
        physicalPrintError = err?.message || String(err);
      }
    } else {
      physicalPrintError = 'No active printer configured for this counter';
    }

    return {
      success: true,
      message: isReprint
        ? 'Receipt reprinted successfully'
        : 'Receipt printed successfully',
      data: {
        invoiceNumber: sale.invoiceNumber,
        receiptText,
        printedAt: new Date(),
        isReprint,
        printer: printerInfo,
        physicalPrintStatus,
        physicalPrintError,
      },
      statusCode: HttpStatus.OK,
    };
  }

  async createPrinter(
    dto: CreatePrinterDto,
    userId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);
      await this.companyService.validateCompany(dto.companyId, userId);

      if (dto.isDefault) {
        await this.printerModel.updateMany(
          {
            companyId: new Types.ObjectId(dto.companyId),
            isDeleted: false,
          },
          { $set: { isDefault: false } },
        );
      }

      const created = await this.genericCreateOne({
        ...dto,
        printerName: dto.printerName.trim(),
        printerIp: dto.printerIp.trim(),
        counterId: dto.counterId ? new Types.ObjectId(dto.counterId) : null,
        paperWidth: dto.paperWidth || PaperWidth.MM_80,
        isDefault: dto.isDefault ?? false,
        isActive: true,
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(dto.companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_PRINTER,
        entityType: LogEntityType.PRINTER,
        entityId: new Types.ObjectId(created._id),
        description: `Printer ${created.printerName} created`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Printer created successfully',
        data: created,
        statusCode: HttpStatus.CREATED,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: dto.companyId ? new Types.ObjectId(dto.companyId) : null,
        createdBy: new Types.ObjectId(userId),
        action: LogActions.CREATE_PRINTER,
        entityType: LogEntityType.PRINTER,
        entityId: new Types.ObjectId(),
        description: 'Failed to create printer',
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
      throw new BadRequestException('Failed to create printer');
    }
  }

  async findAllPrinters(
    userId: string,
    companyId: string,
    roles: string[],
    page: number,
    limit: number,
    req: AuthedRequest,
    search?: string,
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin = roles.includes('superadmin');

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
          { printerName: { $regex: search, $options: 'i' } },
          { printerIp: { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [data, totalCount] = await Promise.all([
        this.printerModel
          .find(filter)
          .populate([
            {
              path: PrinterModelConstants.counterId,
              select: `${CounterModelConstants.name} ${CounterModelConstants.code}`,
            },
            {
              path: PrinterModelConstants.createdBy,
              select: `${UserModelConstants.username} ${UserModelConstants.name}`,
            },
          ])
          .sort({ isDefault: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.printerModel.countDocuments(filter),
      ]);

      return {
        success: true,
        message: 'Printers fetched successfully',
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
      throw new BadRequestException('Error fetching printers');
    }
  }

  async findOnePrinter(
    id: string,
    userId: string,
    companyId: string,
    roles: string[],
  ) {
    try {
      await this.userService.validateAuthenticatedUser(userId);
      const isSuperAdmin = roles.includes('superadmin');

      const filter: Record<string, unknown> = {
        _id: id,
        isDeleted: false,
      };

      if (!isSuperAdmin) {
        filter.companyId = new Types.ObjectId(companyId);
      }

      const printer = await this.printerModel.findOne(filter).populate([
        {
          path: PrinterModelConstants.counterId,
          select: `${CounterModelConstants.name} ${CounterModelConstants.code}`,
        },
        {
          path: PrinterModelConstants.createdBy,
          select: `${UserModelConstants.username} ${UserModelConstants.name}`,
        },
      ]);

      if (!printer) {
        throw new NotFoundException('Printer not found');
      }

      return {
        success: true,
        message: 'Printer fetched successfully',
        data: printer,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Error fetching printer');
    }
  }

  async updatePrinter(
    id: string,
    dto: UpdatePrinterDto,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const printer = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!printer) {
        throw new NotFoundException('Printer not found');
      }

      if (dto.isDefault) {
        await this.printerModel.updateMany(
          {
            companyId: new Types.ObjectId(companyId),
            _id: { $ne: new Types.ObjectId(id) },
            isDeleted: false,
          },
          { $set: { isDefault: false } },
        );
      }

      const updated = await this.genericUpdateOne(id, {
        ...dto,
        ...(dto.printerName && { printerName: dto.printerName.trim() }),
        ...(dto.printerIp && { printerIp: dto.printerIp.trim() }),
        ...(dto.counterId !== undefined && {
          counterId: dto.counterId ? new Types.ObjectId(dto.counterId) : null,
        }),
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_PRINTER,
        entityType: LogEntityType.PRINTER,
        entityId: new Types.ObjectId(id),
        description: `Printer ${updated?.printerName} updated`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Printer updated successfully',
        data: updated,
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.UPDATE_PRINTER,
        entityType: LogEntityType.PRINTER,
        entityId: new Types.ObjectId(id),
        description: 'Failed to update printer',
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
      throw new BadRequestException('Error updating printer');
    }
  }

  async deletePrinter(
    id: string,
    userId: string,
    companyId: string,
    req: AuthedRequest,
  ) {
    try {
      const ipAddress = await this.getClientIpAddress(req);
      await this.userService.validateAuthenticatedUser(userId);

      const printer = await this.genericFindOne({
        _id: id,
        companyId: new Types.ObjectId(companyId),
      });

      if (!printer) {
        throw new NotFoundException('Printer not found');
      }

      await this.genericUpdateOne(id, {
        isActive: false,
        isDeleted: true,
      });

      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_PRINTER,
        entityType: LogEntityType.PRINTER,
        entityId: new Types.ObjectId(id),
        description: `Printer ${printer.printerName} deleted`,
        ipAddress,
        path: req.url,
        status: LogStatus.SUCCESS,
      });

      return {
        success: true,
        message: 'Printer deleted successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error: unknown) {
      const ipAddress = await this.getClientIpAddress(req);
      await this.logService.createLog({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(userId),
        action: LogActions.DELETE_PRINTER,
        entityType: LogEntityType.PRINTER,
        entityId: new Types.ObjectId(id),
        description: 'Failed to delete printer',
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
      throw new BadRequestException('Error deleting printer');
    }
  }
}
