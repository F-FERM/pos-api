import { PartialType } from '@nestjs/swagger';
import { CreateStoreLicenseDto } from './create-store-license.dto';

export class UpdateStoreLicenseDto extends PartialType(CreateStoreLicenseDto) {}
