import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

export interface PermissionRequirement {
  subModule: string;
  action: 'Create' | 'Read' | 'Update' | 'Delete';
}

export const CheckPermission = (...permissions: PermissionRequirement[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
