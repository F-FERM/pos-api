import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { AuthedRequest } from '../utils/common.types';
import { UserDocument, UserModelConstants } from '../models/user.schema';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string) {
    const user = await this.userService.validateUser(username, pass);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(user: any, req?: AuthedRequest) {
    try {
      const _user = (await this.userService.genericFindOneWithPopulate(
        { _id: user._id },
        [
          {
            path: UserModelConstants.privilegeId,
            select: 'roles',
          },
        ],
      )) as UserDocument;

      if (!_user?.privilegeId) {
        throw new BadRequestException('Privilege not found');
      }

      const privilege: any = _user.privilegeId;

      const roles = Array.isArray(privilege.roles)
        ? privilege.roles
        : [privilege.roles];

      const payload: any = {
        username: _user.username,
        userId: _user._id,
        companyId: _user.companyId,
        email: _user.email,
        roles,
      };

      return {
        access_token: this.jwtService.sign(payload),
        expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.log('Error while login user', error.message);
        throw new BadRequestException(error.message);
      }
      console.log('Error while login user', error);
      throw new BadRequestException('Error while login user');
    }
  }
}
