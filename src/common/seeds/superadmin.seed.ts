import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../../models/user.schema';
import { PrivilegesDocument } from '../../models/privilege.schema';
import { SYSTEM_PRIVILEGES } from './privileges.data';
import { Role } from '../../utils/role.enum';

export async function seedSuperAdminUser(
  userModel: Model<UserDocument>,
  privilegeModel: Model<PrivilegesDocument>,
): Promise<void> {
  try {
    const username = 'anees';
    const email = 'aneespengad4447@gmail.com';
    const rawPassword = '000000';

    const defaultSuperAdminData = SYSTEM_PRIVILEGES.find((p) =>
      p.roles.includes(Role.superadmin),
    ) || {
      name: Role.superadmin,
      description: 'System Super Administrator',
      roles: [Role.superadmin],
      isSystemGenerated: true,
    };

    let superAdminPrivilege = await privilegeModel.findOne({
      $or: [
        { name: defaultSuperAdminData.name },
        { name: 'Super Admin' },
        { roles: Role.superadmin },
      ],
      isDeleted: false,
    });

    if (!superAdminPrivilege) {
      superAdminPrivilege = await privilegeModel.create({
        name: defaultSuperAdminData.name,
        description: defaultSuperAdminData.description,
        roles: defaultSuperAdminData.roles,
        isSystemGenerated: defaultSuperAdminData.isSystemGenerated,
      });
      console.log(
        '[SEED] System Superadmin Privilege created from SYSTEM_PRIVILEGES seed data',
      );
    }

    const existingSuperAdmin = await userModel.findOne({
      $or: [{ username }, { email }],
      isDeleted: false,
    });

    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await userModel.create({
        username,
        name: 'Anees (Super Admin)',
        email,
        password: hashedPassword,
        privilegeId: superAdminPrivilege._id,
        companyId: null,
        isActive: true,
      });
      console.log(
        `[SEED] Super Admin user '${username}' (${email}) seeded successfully with PIN/Password: ${rawPassword}`,
      );
    } else {
      if (!existingSuperAdmin.privilegeId) {
        await userModel.updateOne(
          { _id: existingSuperAdmin._id },
          { $set: { privilegeId: superAdminPrivilege._id } },
        );
      }
    }
  } catch (error: unknown) {
    console.warn('[SEED] Error seeding Super Admin user:', error);
  }
}
