import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthedRequest } from '../utils/common.types';
import { LoginDto } from './dto/login.DTO';
import { RegisterStoreRequestDto } from './dto/register-store-request.dto';
import { VerifyOtpRequestDto } from './dto/verify-otp-request.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'User login and get access_token' })
  async login(@Body() loginDto: LoginDto, @Req() req?: AuthedRequest) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    return this.authService.login(user, req);
  }

  @Public()
  @Post('request-store-otp')
  @ApiOperation({
    summary:
      'Step 1: Request store registration & email 6-digit verification OTP',
  })
  requestStoreOtp(@Body() dto: RegisterStoreRequestDto) {
    return this.authService.requestStoreRegistration(dto);
  }

  @Public()
  @Post('verify-store-otp')
  @ApiOperation({
    summary:
      'Step 2: Verify email OTP code, register store & user, and issue Store License Key',
  })
  verifyStoreOtp(@Body() dto: VerifyOtpRequestDto) {
    return this.authService.verifyStoreOtp(dto);
  }
}
