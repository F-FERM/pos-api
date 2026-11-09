import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentTermsService } from './payment-terms.service';
import {
  BulkUpdatePaymentTermDto,
  CreatePaymentTermDto,
  UpdatePaymentTermDto,
} from './dto/create-payment-term.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { ApiOperation } from '@nestjs/swagger';
import { type AuthedRequest } from 'src/utils/common.types';
import { CheckPermission } from 'src/common/decorators/check-permission.decorator';
import { SUB_MODULES } from 'src/common/constants/submodules.constants';
import { ACTIONS } from 'src/common/constants/actions.constants';
import { SkipSubscription } from 'src/common/decorators/skip-subscription.decorator';

@Controller('payment-terms')
export class PaymentTermsController {
  constructor(private readonly service: PaymentTermsService) {}

  /**
   * Creates a new payment term.
   *
   * @param dto - Data transfer object containing the details of the payment term.
   * @param req - The authenticated request object containing user and company information.
   * @returns A promise that resolves to the created payment term.
   */
  @ApiOperation({ summary: 'create payment term' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.PAYMENT_TERMS,
  //   action: ACTIONS.CREATE,
  // })
  @Post()
  create(
    @Body() dto: CreatePaymentTermDto | CreatePaymentTermDto[],
    @Req() req: AuthedRequest,
  ) {
    return this.service.create(dto, req.user.userId, req.user.companyId, req);
  }

  /**
   * Retrieves a paginated list of payment terms.
   *
   * @param req - The authenticated request object containing user, company, and role information.
   * @param page - The page number for pagination.
   * @param limit - The number of items per page.
   * @param search - An optional search string to filter payment terms by name.
   * @returns A promise that resolves to a paginated list of payment terms.
   */
  @ApiOperation({ summary: 'get all payment terms' })
  @SkipSubscription()
  // @CheckPermission({
  //   subModule: SUB_MODULES.PAYMENT_TERMS,
  //   action: ACTIONS.READ,
  // })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(
      req.user.userId,
      req.user.companyId,
      req.user.roles,
      page,
      limit,
      search,
    );
  }

  /**
   * Retrieves a single payment term by its ID.
   *
   * @param id - The unique identifier of the payment term.
   * @param req - The authenticated request object containing user, company, and role information.
   * @returns A promise that resolves to the requested payment term.
   */
  @ApiOperation({ summary: 'get payment term by id' })
  @SkipSubscription()
  // @CheckPermission({
  //   subModule: SUB_MODULES.PAYMENT_TERMS,
  //   action: ACTIONS.READ,
  // })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.service.findOne(
      id,
      req.user.userId,
      req.user.companyId,
      req.user.roles,
    );
  }

  /**
   * Updates an existing payment term.
   *
   * @param id - The unique identifier of the payment term to update.
   * @param dto - Data transfer object containing the fields to update.
   * @param req - The authenticated request object containing user and company information.
   * @returns A promise that resolves to the updated payment term.
   */
  @ApiOperation({ summary: 'update payment term(s)' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.PAYMENT_TERMS,
  //   action: ACTIONS.UPDATE,
  // })
  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdatePaymentTermDto | BulkUpdatePaymentTermDto[],
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(
      id,
      dto,
      req.user.userId,
      req.user.companyId,
      req,
    );
  }

  /**
   * Deletes a payment term.
   *
   * @param id - The unique identifier of the payment term to delete.
   * @param req - The authenticated request object containing user and company information.
   * @returns A promise that resolves to a success message.
   */
  @ApiOperation({ summary: 'delete payment term' })
  // @CheckPermission({
  //   subModule: SUB_MODULES.PAYMENT_TERMS,
  //   action: ACTIONS.DELETE,
  // })
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.service.delete(id, req.user.userId, req.user.companyId, req);
  }
}
