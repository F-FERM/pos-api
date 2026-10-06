import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JWT_CONSTANTS } from './jwt.constants';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { LogModule } from '../log/log.module';
import { ModuleSchema, ModuleSchemaName } from '../models/module.schema';
import {
  SubModuleSchema,
  SubModuleSchemaName,
} from '../models/sub-module.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ModuleSchemaName, schema: ModuleSchema },
      { name: SubModuleSchemaName, schema: SubModuleSchema },
    ]),
    UserModule,
    LogModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_CONSTANTS.secret,
      signOptions: { expiresIn: '7d' }, // 7 days
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
