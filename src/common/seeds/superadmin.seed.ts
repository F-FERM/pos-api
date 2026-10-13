import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../../models/user.schema';
import { PrivilegesDocument } from '../../models/privilege.schema';
import { Role } from '../../utils/role.enum';

export async function seedSuperAdminUser(
  userModel: Model<UserDocument>,
  privilegeModel: Model<PrivilegesDocument>,
): Promise<void> {
  try {
    const username = 'anees';
    const email = 'aneespengad4447@gmail.com';
    const rawPassword = '000000';

    let superAdminPrivilege = await privilegeModel.findOne({
      $or: [{ name: Role.superadmin }, { roles: Role.superadmin }],
      isDeleted: false,
    });

    if (!superAdminPrivilege) {
      superAdminPrivilege = await privilegeModel.create({
        name: Role.superadmin,
        description: 'System Super Administrator',
        roles: [Role.superadmin],
        isSystemGenerated: true,
      });
      console.log('[SEED] Super Admin privilege created successfully.');
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const existingSuperAdmin = await userModel.findOne({
      $or: [{ username }, { email }],
      isDeleted: false,
    });

    if (!existingSuperAdmin) {
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
        `[SEED] Super Admin user '${username}' (${email}) seeded successfully with default password '${rawPassword}'.`,
      );
    } else {
      await userModel.updateOne(
        { _id: existingSuperAdmin._id },
        {
          $set: {
            privilegeId: superAdminPrivilege._id,
            password: hashedPassword,
            isActive: true,
          },
        },
      );
      console.log(
        `[SEED] Super Admin user '${username}' (${email}) credentials & privilege refreshed successfully.`,
      );
    }
  } catch (error: unknown) {
    console.warn('[SEED] Error seeding Super Admin user:', error);
  }
}
