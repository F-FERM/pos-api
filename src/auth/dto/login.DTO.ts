import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Enter registered username of the user' })
  @IsNotEmpty()
  username: string;

  @ApiProperty({ description: 'Enter password of the user' })
  @IsNotEmpty()
  password: string;
}
