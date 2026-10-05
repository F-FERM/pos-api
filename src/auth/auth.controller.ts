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
import { ApiOperation } from '@nestjs/swagger';
import { type AuthedRequest } from '../utils/common.types';
import { LoginDto } from './dto/login.DTO';

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
}
