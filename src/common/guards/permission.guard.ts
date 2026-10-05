import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/check-permission.decorator';
import { Role } from '../../utils/role.enum';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const permissionsMeta = this.reflector.get<
      {
        subModule: string;
        action: string;
      }[]
    >(PERMISSION_KEY, context.getHandler());

    if (!permissionsMeta || permissionsMeta.length === 0) return true;

    if (
      user?.roles?.includes(Role.superadmin) ||
      user?.roles?.includes(Role.admin)
    ) {
      return true;
    }

    if (!user?.permissions || !Array.isArray(user.permissions)) {
      throw new ForbiddenException({
        message: 'Access denied: No permissions assigned.',
        code: 'NO_PERMISSIONS',
      });
    }

    const hasAccess = permissionsMeta.some(({ subModule, action }) => {
      const perm = user.permissions.find((p) => p.subModule === subModule);

      if (!perm) return false;

      const key = `can${action}`;

      return !!perm[key];
    });

    if (!hasAccess) {
      throw new ForbiddenException({
        message: 'Access denied: insufficient permissions.',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissionsMeta,
      });
    }

    return true;
  }
}
