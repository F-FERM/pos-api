import { PartialType } from '@nestjs/swagger';
import { CreateSaleReturnDto } from './create-sale-return.dto';

export class UpdateSaleReturnDto extends PartialType(CreateSaleReturnDto) {}
