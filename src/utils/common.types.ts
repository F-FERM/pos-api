export interface IPayload {
  username: string;
  userId: string;
  companyId: string;
  roles: string[];
  email: string;
}

export type AuthedRequest = Request & { user: IPayload };
