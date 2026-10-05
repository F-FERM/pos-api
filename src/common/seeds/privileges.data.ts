import { Role } from "../../utils/role.enum";


export const SYSTEM_PRIVILEGES = [
  {
    name: Role.superadmin,
    description: 'System Super Administrator',
    roles: [Role.superadmin],
    isSystemGenerated: true,
  },
];
