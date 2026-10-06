import { Request } from 'express';

export interface IPermission {
  subModule: string;
  subModuleId?: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface IPayload {
  username: string;
  userId: string;
  companyId: string;
  roles: string[];
  email: string;
  modules: string[];
  permissions: IPermission[];
}

export type AuthedRequest = Request & { user: IPayload };
