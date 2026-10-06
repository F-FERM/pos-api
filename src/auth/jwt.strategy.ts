import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_CONSTANTS } from './jwt.constants';
import { IPayload } from '../utils/common.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_CONSTANTS.secret,
    });
  }

  async validate(payload: any): Promise<IPayload> {
    return {
      userId: payload.userId,
      companyId: payload.companyId,
      username: payload.username,
      email: payload.email || '',
      roles: payload.roles || [],
      modules: payload.modules || [],
      permissions: payload.permissions || [],
    };
  }
}
